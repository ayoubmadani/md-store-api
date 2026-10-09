import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Order, StatusEnum, TypeShipEnum } from '../order/entities/order.entity';
import { OrderItem } from '../order/entities/order-item.entity';
import { Product } from '../product/entities/product.entity';
import { Store } from '../store/entities/store.entity';
import { Shipping } from '../shipping/entity/shipping.entity';
import { Commune } from '../shipping/entity/commune.entity';
import { User } from '../user/entities/user.entity';
import { ShippingProviderService } from '../shipping-provider/shipping-provider.service';
import { ConfirmationAction, ConfirmationLog } from './entities/confirmation-log.entity';
import { ConfirmationMember } from './entities/confirmation-member.entity';
import { ConfirmationService, QUEUE_STATUSES } from './confirmation.service';
import { AgentEditOrderDto, AgentSetStatusDto } from './dto/confirmation.dto';

const LOCK_MINUTES = 15;          // طلب أخذه موظف ولم يكمله يرجع للقائمة بعد 15 دقيقة
const RETRY_AFTER_HOURS = 2;      // محاولة فاشلة → يظهر مرة أخرى بعد ساعتين
const ATTEMPT_STATUSES = [StatusEnum.APPL1, StatusEnum.APPL2, StatusEnum.APPL3];

@Injectable()
export class ConfirmationAgentService {
  private readonly logger = new Logger(ConfirmationAgentService.name);

  constructor(
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(ConfirmationLog) private readonly logRepo: Repository<ConfirmationLog>,
    private readonly confirmation: ConfirmationService,
    private readonly shipping: ShippingProviderService,
    private readonly dataSource: DataSource,
  ) {}

  // ══════════════════════════════════════════════════════════════════════════
  // القائمة المشتركة
  // ══════════════════════════════════════════════════════════════════════════

  async queueSummary(userId: string) {
    const member = await this.confirmation.requireMembership(userId);
    const [row] = await this.dataSource.query(
      `SELECT
         COUNT(*) FILTER (WHERE ("confirmationLockedUntil" IS NULL OR "confirmationLockedUntil" < now())
                            AND ("confirmationNextAttemptAt" IS NULL OR "confirmationNextAttemptAt" <= now())) AS "available",
         COUNT(*) FILTER (WHERE "confirmationNextAttemptAt" > now()) AS "scheduled",
         COUNT(*) FILTER (WHERE "confirmationLockedUntil" >= now()) AS "inProgress"
       FROM "orders"
       WHERE "confirmationCompanyId" = $1 AND status = ANY($2)`,
      [member.companyId, QUEUE_STATUSES],
    );
    const current = await this.currentLock(member);
    return {
      available: Number(row.available), scheduled: Number(row.scheduled), inProgress: Number(row.inProgress),
      currentOrderId: current?.id ?? null,
    };
  }

  /** حالة الحجز محسوبة في قاعدة البيانات (now()) — لا نقارن الأوقات في JS بسبب فرق المنطقة الزمنية */
  private async lockState(orderId: string, agentId: string) {
    const [row] = await this.dataSource.query(
      `SELECT ("confirmationAgentId" = $2 AND "confirmationLockedUntil" > now()) AS "lockedByMe",
              ("confirmationAgentId" IS DISTINCT FROM $2 AND "confirmationLockedUntil" > now()) AS "lockedByOther",
              "confirmationAgentId" AS "agentId",
              GREATEST(0, EXTRACT(EPOCH FROM ("confirmationLockedUntil" - now())))::int AS "secondsLeft"
         FROM "orders" WHERE id = $1`,
      [orderId, agentId],
    );
    return {
      lockedByMe: !!row?.lockedByMe,
      // زميل يعمل على الطلب الآن (قيد التأكيد)
      lockedByOtherId: row?.lockedByOther ? (row.agentId as string) : null,
      secondsLeft: row?.lockedByMe ? Number(row.secondsLeft) : 0,
    };
  }

  private currentLock(member: ConfirmationMember) {
    return this.orderRepo
      .createQueryBuilder('o')
      .where('o.confirmationCompanyId = :companyId', { companyId: member.companyId })
      .andWhere('o.confirmationAgentId = :agentId', { agentId: member.userId })
      .andWhere('o.confirmationLockedUntil > now()')
      .andWhere('o.status IN (:...statuses)', { statuses: QUEUE_STATUSES })
      .getOne();
  }

  /**
   * "الطلب التالي": يرجع الطلب الذي بيد الموظف إن وُجد، وإلا يحجز أقدم طلب
   * جاهز في قائمة شركته. SKIP LOCKED يضمن ألا يأخذ موظفان نفس الطلب.
   */
  async next(userId: string) {
    const member = await this.confirmation.requireMembership(userId);
    const current = await this.currentLock(member);
    if (current) return this.detail(userId, current.id);

    const result = await this.dataSource.query(
      `UPDATE "orders"
          SET "confirmationAgentId" = $1,
              "confirmationLockedUntil" = now() + make_interval(mins => $4)
        WHERE id = (
          SELECT id FROM "orders"
           WHERE "confirmationCompanyId" = $2
             AND status = ANY($3)
             AND ("confirmationLockedUntil" IS NULL OR "confirmationLockedUntil" < now())
             AND ("confirmationNextAttemptAt" IS NULL OR "confirmationNextAttemptAt" <= now())
           ORDER BY COALESCE("confirmationNextAttemptAt", "confirmationSentAt") ASC
           LIMIT 1
           FOR UPDATE SKIP LOCKED)
      RETURNING id, status`,
      [member.userId, member.companyId, QUEUE_STATUSES, LOCK_MINUTES],
    );
    const claimed = (Array.isArray(result[0]) ? result[0][0] : result[0]) as { id: string; status: string } | undefined;
    if (!claimed) return null;

    await this.log(claimed.id, member, ConfirmationAction.CLAIMED, { fromStatus: claimed.status });
    return this.detail(userId, claimed.id);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // قائمة طلبات الشركة (تبويبات)
  // ══════════════════════════════════════════════════════════════════════════

  static readonly TABS: Record<string, StatusEnum[]> = {
    new: [StatusEnum.PENDING],
    attempts: [StatusEnum.APPL1, StatusEnum.APPL2, StatusEnum.APPL3],
    postponed: [StatusEnum.POSTPONED],
    confirmed: [StatusEnum.CONFIRMED, StatusEnum.SHIPPING, StatusEnum.DELIVERED],
    cancelled: [StatusEnum.CANCELLED, StatusEnum.RETURNED],
  };

  async list(userId: string, tab = 'new', search?: string, page = 1) {
    const member = await this.confirmation.requireMembership(userId);
    const take = 30;
    const statuses = ConfirmationAgentService.TABS[tab];

    const qb = this.orderRepo
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.items', 'item')
      .leftJoinAndSelect('item.product', 'product')
      .leftJoinAndSelect('o.customerWilaya', 'wilaya')
      .leftJoinAndSelect('o.customerCommune', 'commune')
      .leftJoin('o.store', 'store')
      .addSelect(['store.id', 'store.name'])
      .where('o.confirmationCompanyId = :companyId', { companyId: member.companyId });
    if (statuses) qb.andWhere('o.status IN (:...statuses)', { statuses });
    if (search?.trim()) {
      qb.andWhere('(o.customerName ILIKE :s OR o.customerPhone LIKE :s)', { s: `%${search.trim()}%` });
    }
    // الجديدة والمحاولات: الأقدم أولاً (بالترتيب الذي يُتصل به)؛ الباقي: الأحدث أولاً
    if (tab === 'new' || tab === 'attempts' || tab === 'postponed') {
      // (تعبير COALESCE لا يعمل مع skip/take في TypeORM — عمودان بنفس الترتيب)
      qb.orderBy('o.confirmationNextAttemptAt', 'ASC', 'NULLS FIRST').addOrderBy('o.confirmationSentAt', 'ASC');
    } else {
      qb.orderBy('o.updatedAt', 'DESC');
    }
    qb.skip((Math.max(page, 1) - 1) * take).take(take);

    const [orders, total] = await qb.getManyAndCount();

    // الحجز ووقت الجاهزية يُحسبان في قاعدة البيانات (now()) — لا مقارنة أوقات في JS
    const ids = orders.map((o) => o.id);
    const states: Array<{ id: string; agentId: string | null; locked: boolean; readyIn: number | null }> = ids.length
      ? await this.dataSource.query(
        `SELECT id, "confirmationAgentId" AS "agentId",
                ("confirmationLockedUntil" > now()) AS "locked",
                CASE WHEN "confirmationNextAttemptAt" > now()
                     THEN EXTRACT(EPOCH FROM ("confirmationNextAttemptAt" - now()))::int END AS "readyIn"
           FROM "orders" WHERE id = ANY($1)`,
        [ids],
      )
      : [];
    const agentIds = [...new Set(states.filter((st) => st.locked && st.agentId).map((st) => st.agentId!))];
    const agents = agentIds.length
      ? await this.dataSource.getRepository(User).find({ where: { id: In(agentIds) }, select: ['id', 'username'] })
      : [];

    const [counts] = await this.dataSource.query(
      `SELECT ${Object.entries(ConfirmationAgentService.TABS)
        .map(([key, sts]) => `COUNT(*) FILTER (WHERE status IN (${sts.map((x) => `'${x}'`).join(',')})) AS "${key}"`)
        .join(', ')}, COUNT(*) AS "all"
         FROM "orders" WHERE "confirmationCompanyId" = $1`,
      [member.companyId],
    );

    return {
      total,
      page,
      pages: Math.ceil(total / take),
      counts: Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, Number(v)])),
      orders: orders.map((o) => {
        const st = states.find((x) => x.id === o.id);
        const lockedBy = st?.locked ? st.agentId : null;
        const itemsTotal = o.items.reduce((sum, i) => sum + Number(i.totalPrice || 0), 0);
        return {
          id: o.id,
          status: o.status,
          createdAt: o.createdAt,
          customerName: o.customerName,
          customerPhone: o.customerPhone,
          wilaya: o.customerWilaya?.ar_name ?? null,
          commune: o.customerCommune?.ar_name ?? null,
          store: o.store?.name ?? null,
          products: o.items.map((i) => ({ name: i.product?.name ?? null, quantity: i.quantity })),
          total: itemsTotal + Number(o.priceShip || 0),
          readyIn: st?.readyIn ?? null,
          lockedByMe: lockedBy === member.userId,
          lockedBy: lockedBy && lockedBy !== member.userId
            ? { id: lockedBy, username: agents.find((a) => a.id === lockedBy)?.username ?? null }
            : null,
        };
      }),
    };
  }

  /**
   * أخذ طلب معيّن من القائمة (حتى لو كان مجدولاً لاحقاً). الموظف يحمل طلباً
   * واحداً فقط: أي طلب آخر بيده يرجع للقائمة.
   */
  async claim(userId: string, orderId: string) {
    const member = await this.confirmation.requireMembership(userId);
    const result = await this.dataSource.query(
      `UPDATE "orders"
          SET "confirmationAgentId" = $1,
              "confirmationLockedUntil" = now() + make_interval(mins => $5)
        WHERE id = $2
          AND "confirmationCompanyId" = $3
          AND status = ANY($4)
          AND ("confirmationLockedUntil" IS NULL OR "confirmationLockedUntil" < now() OR "confirmationAgentId" = $1)
      RETURNING id, status`,
      [member.userId, orderId, member.companyId, QUEUE_STATUSES, LOCK_MINUTES],
    );
    const claimed = (Array.isArray(result[0]) ? result[0][0] : result[0]) as { id: string; status: string } | undefined;
    if (!claimed) throw new BadRequestException('هذا الطلب بيد زميل أو لم يعد بانتظار التأكيد');

    await this.dataSource.query(
      `UPDATE "orders" SET "confirmationLockedUntil" = NULL
        WHERE "confirmationCompanyId" = $1 AND "confirmationAgentId" = $2 AND id != $3
          AND "confirmationLockedUntil" > now()`,
      [member.companyId, member.userId, orderId],
    );
    await this.log(orderId, member, ConfirmationAction.CLAIMED, { fromStatus: claimed.status });
    return this.detail(userId, orderId);
  }

  async release(userId: string, orderId: string) {
    const { member } = await this.requireLock(userId, orderId);
    await this.orderRepo.update(orderId, { confirmationLockedUntil: null });
    await this.log(orderId, member, ConfirmationAction.RELEASED);
    return { success: true };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // تفاصيل الطلب
  // ══════════════════════════════════════════════════════════════════════════

  /** الموظف يرى أي طلب لشركته (للعرض)؛ التعديل يتطلب أن يكون محجوزاً له */
  async detail(userId: string, orderId: string) {
    const member = await this.confirmation.requireMembership(userId);
    const order = await this.orderRepo.findOne({
      where: { id: orderId, confirmationCompanyId: member.companyId },
      relations: [
        'items', 'items.product', 'items.product.imagesProduct', 'items.variantDetail', 'items.offer',
        'customerWilaya', 'customerCommune', 'store',
      ],
    });
    if (!order) throw new NotFoundException('الطلب غير موجود');

    const productIds = [...new Set(order.items.map((i) => i.productId))];
    const [products, store, customerHistory, logs, rates] = await Promise.all([
      this.dataSource.getRepository(Product).find({
        where: { id: In(productIds) },
        relations: ['offers', 'variantDetails', 'imagesProduct'],
      }),
      this.dataSource.getRepository(Store).findOne({ where: { id: order.storeId }, relations: ['user'] }),
      this.customerHistory(order),
      this.confirmation.logsWithAgents({ orderId: order.id }, 50),
      this.merchantRates(order.storeId),
    ]);

    const itemsTotal = order.items.reduce((s, i) => s + Number(i.totalPrice || 0), 0);
    const lockState = await this.lockState(order.id, member.userId);
    const lockedByMe = lockState.lockedByMe && QUEUE_STATUSES.includes(order.status);

    return {
      id: order.id,
      status: order.status,
      createdAt: order.createdAt,
      isDigital: order.isDigital,
      store: { id: order.storeId, name: store?.name ?? order.store?.name ?? null },
      customer: {
        name: order.customerName,
        phone: order.customerPhone,
        whatsapp: order.customerWhatsapp ?? null,
        email: order.customerEmail ?? null,
        wilaya: order.customerWilaya ? { id: order.customerWilaya.id, name: order.customerWilaya.name, ar_name: order.customerWilaya.ar_name } : null,
        commune: order.customerCommune ? { id: order.customerCommune.id, name: order.customerCommune.name, ar_name: order.customerCommune.ar_name } : null,
      },
      typeShip: order.typeShip,
      priceShip: Number(order.priceShip || 0),
      itemsTotal,
      total: itemsTotal + Number(order.priceShip || 0),
      postponedUntil: order.postponedUntil ?? null,
      lock: {
        lockedByMe,
        secondsLeft: lockedByMe ? lockState.secondsLeft : 0,
        lockedBy: lockState.lockedByOtherId && QUEUE_STATUSES.includes(order.status)
          ? {
            id: lockState.lockedByOtherId,
            username: (await this.dataSource.getRepository(User).findOne({
              where: { id: lockState.lockedByOtherId }, select: ['id', 'username'],
            }))?.username ?? null,
          }
          : null,
      },
      items: order.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        productName: i.product?.name ?? null,
        image: i.product?.imagesProduct?.[0]?.imageUrl ?? null,
        quantity: i.quantity,
        finalPrice: Number(i.finalPrice),
        totalPrice: Number(i.totalPrice),
        offerId: i.offerId ?? null,
        variantDetailId: i.variantDetailId ?? null,
        variant: i.variantDetail?.name ?? null,
        offerName: i.offer?.name ?? null,
      })),
      // خيارات كل منتج — المفعّلة فقط — لتعديل العرض/الاختيار
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        price: Number(p.price),
        image: p.imagesProduct?.[0]?.imageUrl ?? null,
        offers: (p.offers ?? []).filter((o) => o.isActive !== false)
          .map((o) => ({ id: o.id, name: o.name, quantity: o.quantity, price: Number(o.price), shippingFree: o.shippingFree })),
        variants: (p.variantDetails ?? []).filter((v) => v.isActive !== false)
          .map((v) => ({ id: v.id, name: v.name, price: Number(v.price), stock: v.stock })),
      })),
      shippingRates: rates.map((r) => ({ wilayaId: r.wilayaId, priceHome: Number(r.priceHome), priceOffice: Number(r.priceOffice) })),
      customerHistory,
      history: logs,
    };
  }

  /** طلبات سابقة بنفس رقم الهاتف في نفس المتجر — مؤشر على الزبون الوهمي */
  private async customerHistory(order: Order) {
    const rows: Array<{ status: string; count: string }> = await this.orderRepo
      .createQueryBuilder('o')
      .select('o.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('o.storeId = :storeId', { storeId: order.storeId })
      .andWhere('o.customerPhone = :phone', { phone: order.customerPhone })
      .andWhere('o.id != :id', { id: order.id })
      .groupBy('o.status')
      .getRawMany();
    const by = Object.fromEntries(rows.map((r) => [r.status, Number(r.count)]));
    return {
      total: rows.reduce((s, r) => s + Number(r.count), 0),
      delivered: by[StatusEnum.DELIVERED] ?? 0,
      returned: by[StatusEnum.RETURNED] ?? 0,
      cancelled: by[StatusEnum.CANCELLED] ?? 0,
    };
  }

  private async merchantRates(storeId: string) {
    const store = await this.dataSource.getRepository(Store).findOne({ where: { id: storeId }, relations: ['user'] });
    if (!store) return [];
    return this.dataSource.getRepository(Shipping).find({ where: { userId: store.user.id, isActive: true } });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // التعديل والحالة
  // ══════════════════════════════════════════════════════════════════════════

  private async requireLock(userId: string, orderId: string) {
    const member = await this.confirmation.requireMembership(userId);
    const order = await this.orderRepo.findOne({ where: { id: orderId, confirmationCompanyId: member.companyId } });
    if (!order) throw new NotFoundException('الطلب غير موجود');
    if (!QUEUE_STATUSES.includes(order.status)) throw new BadRequestException('هذا الطلب لم يعد بانتظار التأكيد');
    const { lockedByMe } = await this.lockState(orderId, member.userId);
    if (!lockedByMe) throw new ForbiddenException('هذا الطلب ليس محجوزاً لك — خذه من "الطلب التالي"');
    return { member, order };
  }

  /** العنوان والكمية والعرض والاختيار — الأسعار والتوصيل يحسبها الخادم */
  async edit(userId: string, orderId: string, dto: AgentEditOrderDto) {
    const { member, order } = await this.requireLock(userId, orderId);
    const changes: string[] = [];

    await this.dataSource.transaction(async (manager) => {
      if (dto.customerName !== undefined) { order.customerName = dto.customerName.trim(); changes.push('name'); }
      if (dto.customerPhone !== undefined) { order.customerPhone = dto.customerPhone.trim(); changes.push('phone'); }
      if (dto.typeShip !== undefined) { order.typeShip = dto.typeShip; changes.push('typeShip'); }
      if (dto.customerWilayaId !== undefined || dto.customerCommuneId !== undefined) {
        const wilayaId = dto.customerWilayaId ?? order.customerWilayaId;
        const communeId = dto.customerCommuneId ?? order.customerCommuneId;
        if (communeId) {
          const commune = await manager.findOne(Commune, { where: { id: communeId } });
          if (!commune || commune.wilayaId !== wilayaId) throw new BadRequestException('البلدية لا تنتمي لهذه الولاية');
        }
        order.customerWilayaId = wilayaId;
        order.customerCommuneId = communeId;
        // العلاقات المحمّلة سابقاً قد تطغى على الأعمدة عند الحفظ
        delete (order as any).customerWilaya;
        delete (order as any).customerCommune;
        changes.push('address');
      }

      let items = await manager.find(OrderItem, { where: { orderId }, relations: ['offer', 'product'] });

      if (dto.items) {
        const products = await manager.find(Product, {
          where: { id: In(dto.items.map((i) => i.productId)), store: { id: order.storeId } },
          relations: ['offers', 'variantDetails'],
        });
        const newItems = dto.items.map((it) => {
          const product = products.find((p) => p.id === it.productId);
          if (!product) throw new BadRequestException('منتج غير موجود في هذا المتجر');
          const offer = it.offerId ? product.offers.find((o) => o.id === it.offerId && o.isActive !== false) : undefined;
          if (it.offerId && !offer) throw new BadRequestException('العرض غير متاح');
          const variant = it.variantDetailId
            ? product.variantDetails.find((v) => v.id === it.variantDetailId && v.isActive !== false)
            : undefined;
          if (it.variantDetailId && !variant) throw new BadRequestException('الاختيار غير متاح');

          // نفس منطق صفحة تعديل الطلب: سعر العرض، وإلا سعر الاختيار، وإلا سعر المنتج
          const unit = offer ? Number(offer.price) : variant && Number(variant.price) > 0 ? Number(variant.price) : Number(product.price);
          return manager.create(OrderItem, {
            orderId,
            productId: product.id,
            quantity: it.quantity,
            offerId: offer?.id,
            variantDetailId: variant?.id,
            finalPrice: unit,
            totalPrice: unit * it.quantity,
            unityPrice: Number(product.price),
            offer, product,
          });
        });
        await manager.delete(OrderItem, { orderId });
        items = await manager.save(newItems);
        changes.push('items');
      }

      const itemsTotal = items.reduce((s, i) => s + Number(i.totalPrice || 0), 0);
      order.totalPrice = itemsTotal;
      if (!order.isDigital && changes.some((c) => ['address', 'typeShip', 'items'].includes(c))) {
        order.priceShip = await this.computeShipping(manager, order, items, itemsTotal);
      }
      await manager.save(Order, order);
    });

    await this.log(orderId, member, ConfirmationAction.EDITED, { note: changes.join(',') });
    return this.detail(userId, orderId);
  }

  /** نفس أولوية لوحة التحكم: توصيل مجاني للعرض/المنتج > عتبة المتجر > سعر الولاية */
  private async computeShipping(manager: any, order: Order, items: OrderItem[], itemsTotal: number) {
    if (items.some((i) => i.offer?.shippingFree || i.product?.shippingFree)) return 0;
    const store = await manager.findOne(Store, { where: { id: order.storeId }, relations: ['user'] });
    if (store?.supportFreeShipping && store.freeShippingMinAmount != null && itemsTotal >= Number(store.freeShippingMinAmount)) {
      return 0;
    }
    if (!order.customerWilayaId || !store) return Number(order.priceShip || 0);
    const rate = await manager.findOne(Shipping, { where: { userId: store.user.id, wilayaId: order.customerWilayaId } });
    if (!rate) return Number(order.priceShip || 0);
    return Number(order.typeShip === TypeShipEnum.OFFICE ? rate.priceOffice : rate.priceHome);
  }

  async setStatus(userId: string, orderId: string, dto: AgentSetStatusDto) {
    const { member, order } = await this.requireLock(userId, orderId);
    const from = order.status;
    const qb = this.orderRepo.createQueryBuilder().update(Order).where('id = :id', { id: orderId });

    if (ATTEMPT_STATUSES.includes(dto.status as StatusEnum)) {
      qb.set({
        status: dto.status as StatusEnum,
        confirmationLockedUntil: null,
        confirmationNextAttemptAt: () => `now() + interval '${RETRY_AFTER_HOURS} hours'`,
      });
    } else if (dto.status === StatusEnum.POSTPONED) {
      if (!dto.postponedUntil || new Date(dto.postponedUntil).getTime() <= Date.now()) {
        throw new BadRequestException('اختر تاريخاً قادماً للتأجيل');
      }
      qb.set({
        status: StatusEnum.POSTPONED,
        confirmationLockedUntil: null,
        postponedUntil: () => 'CAST(:until AS timestamptz)',
        confirmationNextAttemptAt: () => 'CAST(:until AS timestamptz)',
      }).setParameter('until', dto.postponedUntil);
    } else if (dto.status === StatusEnum.CONFIRMED) {
      qb.set({
        status: StatusEnum.CONFIRMED,
        confirmedAt: () => 'now()',
        confirmationLockedUntil: null,
        confirmationNextAttemptAt: null,
      });
    } else {
      qb.set({ status: StatusEnum.CANCELLED, confirmationLockedUntil: null, confirmationNextAttemptAt: null });
    }
    await qb.execute();
    await this.log(orderId, member, ConfirmationAction.STATUS, { fromStatus: from, toStatus: dto.status, note: dto.note });

    let upload: { uploaded: boolean; tracking?: string | null; error?: string } | null = null;
    if (dto.status === StatusEnum.CONFIRMED && !order.isDigital) {
      upload = await this.autoUpload(order, member);
    }
    return { id: orderId, status: dto.status, upload };
  }

  /** رفع الطلب المؤكَّد لشركة التوصيل بحساب التاجر الافتراضي — الفشل لا يلغي التأكيد */
  private async autoUpload(order: Order, member: ConfirmationMember) {
    try {
      const store = await this.dataSource.getRepository(Store).findOne({ where: { id: order.storeId }, relations: ['user'] });
      const result = await this.shipping.uploadOrder(order.storeId, store!.user.id, order.id);
      await this.log(order.id, member, ConfirmationAction.UPLOADED, { toStatus: StatusEnum.SHIPPING, note: result.tracking ?? undefined });
      return { uploaded: true, tracking: result.tracking ?? null };
    } catch (err: any) {
      const message = err?.response?.message ?? err?.message ?? 'upload failed';
      this.logger.warn(`Auto-upload failed for order ${order.id}: ${message}`);
      await this.log(order.id, member, ConfirmationAction.UPLOAD_FAILED, { note: String(message).slice(0, 500) });
      return { uploaded: false, error: String(message) };
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // السجل
  // ══════════════════════════════════════════════════════════════════════════

  async myHistory(userId: string) {
    const member = await this.confirmation.requireMembership(userId);
    const logs = await this.confirmation.logsWithAgents({ agentId: member.userId, companyId: member.companyId }, 100);
    const orderIds = [...new Set(logs.map((l) => l.orderId))];
    const orders = orderIds.length
      ? await this.orderRepo.find({ where: { id: In(orderIds) }, select: ['id', 'customerName', 'customerPhone', 'status'] })
      : [];
    return logs.map((l) => ({ ...l, order: orders.find((o) => o.id === l.orderId) ?? null }));
  }

  private log(orderId: string, member: ConfirmationMember, action: ConfirmationAction,
    extra: { fromStatus?: string; toStatus?: string; note?: string } = {}) {
    return this.logRepo.save(this.logRepo.create({
      orderId, companyId: member.companyId, agentId: member.userId, action, ...extra,
    }));
  }
}
