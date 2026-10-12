import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, In, Repository } from 'typeorm';
import { Order, StatusEnum } from '../order/entities/order.entity';
import { Store } from '../store/entities/store.entity';
import { StoreService } from '../store/store.service';
import { ConfirmationAccess, User, UserRole } from '../user/entities/user.entity';
import { Wallet } from '../payment/entities/wallets.entity';
import { ConfirmationCompany, ConfirmationCompanyStatus } from './entities/confirmation-company.entity';
import { ConfirmationMember, ConfirmationMemberRole } from './entities/confirmation-member.entity';
import { StoreConfirmationCompany } from './entities/store-confirmation-company.entity';
import { ConfirmationAction, ConfirmationLog } from './entities/confirmation-log.entity';
import { ConfirmationBillingService } from './confirmation-billing.service';
import { ShippingProviderService } from '../shipping-provider/shipping-provider.service';
import { ConfirmationBlockedMerchant } from './entities/confirmation-blocked-merchant.entity';
import {
  CreateConfirmationCompanyDto, UpdateConfirmationCompanyDto,
} from './dto/confirmation.dto';

/** الحالات التي يكون فيها الطلب "ينتظر التأكيد" — يمكن إرساله وسحبه وأخذه من القائمة */
export const QUEUE_STATUSES = [
  StatusEnum.PENDING, StatusEnum.APPL1, StatusEnum.APPL2, StatusEnum.APPL3, StatusEnum.POSTPONED,
];

const publicCompany = (c: ConfirmationCompany) => ({
  id: c.id,
  name: c.name,
  description: c.description ?? null,
  phone: c.phone,
  logo: c.logo ?? null,
  wilaya: c.wilaya ? { id: c.wilaya.id, name: c.wilaya.name, ar_name: c.wilaya.ar_name } : null,
  commissionPerDelivered: Number(c.commissionPerDelivered),
  status: c.status,
  paused: isPausedNow(c),
  pausedUntil: isPausedNow(c) ? c.pausedUntil ?? null : null,
  createdAt: c.createdAt,
});

/** متوقفة الآن؟ isPaused بدون تاريخ = حتى الاستئناف اليدوي؛ بتاريخ = حتى ذلك التاريخ */
export const isPausedNow = (c: Pick<ConfirmationCompany, 'isPaused' | 'pausedUntil'>) =>
  !!c.isPaused && (!c.pausedUntil || new Date(c.pausedUntil).getTime() > Date.now());

@Injectable()
export class ConfirmationService {
  private readonly logger = new Logger(ConfirmationService.name);

  constructor(
    @InjectRepository(ConfirmationCompany) private readonly companyRepo: Repository<ConfirmationCompany>,
    @InjectRepository(ConfirmationMember) private readonly memberRepo: Repository<ConfirmationMember>,
    @InjectRepository(StoreConfirmationCompany) private readonly savedRepo: Repository<StoreConfirmationCompany>,
    @InjectRepository(ConfirmationLog) private readonly logRepo: Repository<ConfirmationLog>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(ConfirmationBlockedMerchant) private readonly blockedRepo: Repository<ConfirmationBlockedMerchant>,
    private readonly storeService: StoreService,
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
    private readonly billing: ConfirmationBillingService,
    private readonly shipping: ShippingProviderService,
  ) {}

  // ══════════════════════════════════════════════════════════════════════════
  // العضوية
  // ══════════════════════════════════════════════════════════════════════════

  async findMembership(userId: string) {
    return this.memberRepo.findOne({
      where: { userId, isActive: true },
      relations: ['company', 'company.wilaya'],
    });
  }

  private async accessOf(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId }, select: ['id', 'role', 'confirmationAccess'] });
    return { isAdmin: user?.role === UserRole.ADMIN, access: user?.confirmationAccess ?? ConfirmationAccess.NONE };
  }

  private async requireAccess(userId: string) {
    const { access } = await this.accessOf(userId);
    if (access !== ConfirmationAccess.GRANTED) {
      throw new ForbiddenException('ليس لديك صلاحية مؤكّد طلبيات — اطلبها من الإدارة');
    }
  }

  async requireMembership(userId: string, ownerOnly = false) {
    await this.requireAccess(userId);
    const member = await this.findMembership(userId);
    if (!member) throw new ForbiddenException('أنت لست عضواً في شركة تأكيد');
    if (ownerOnly && member.role !== ConfirmationMemberRole.OWNER) {
      throw new ForbiddenException('هذا الإجراء لمدير الشركة فقط');
    }
    if (member.company.status === ConfirmationCompanyStatus.SUSPENDED) {
      throw new ForbiddenException('حساب الشركة موقوف');
    }
    return member;
  }

  async me(userId: string) {
    const { isAdmin, access } = await this.accessOf(userId);
    const member = access === ConfirmationAccess.GRANTED ? await this.findMembership(userId) : null;
    return {
      isAdmin,
      access,
      member: member ? { id: member.id, role: member.role } : null,
      company: member ? publicCompany(member.company) : null,
      confirmationFee: await this.billing.fee(),
    };
  }

  /** المستخدم يطلب صلاحية مؤكّد — يراها الأدمن في قائمة الطلبات */
  async requestAccess(userId: string) {
    const { access } = await this.accessOf(userId);
    if (access === ConfirmationAccess.GRANTED) return { access };
    await this.userRepo.update(userId, { confirmationAccess: ConfirmationAccess.REQUESTED });
    return { access: ConfirmationAccess.REQUESTED };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // الشركة (من تطبيق المؤكّد)
  // ══════════════════════════════════════════════════════════════════════════

  async registerCompany(userId: string, dto: CreateConfirmationCompanyDto) {
    await this.requireAccess(userId);
    const existing = await this.memberRepo.findOne({ where: { userId } });
    if (existing) throw new ConflictException('أنت عضو في شركة تأكيد مسبقاً');

    return this.dataSource.transaction(async (manager) => {
      const company = await manager.save(manager.create(ConfirmationCompany, {
        ...dto,
        commissionPerDelivered: dto.commissionPerDelivered,
        ownerId: userId,
        status: ConfirmationCompanyStatus.PENDING,
      }));
      await manager.save(manager.create(ConfirmationMember, {
        companyId: company.id, userId, role: ConfirmationMemberRole.OWNER,
      }));
      return publicCompany(company);
    });
  }

  async updateCompany(userId: string, dto: UpdateConfirmationCompanyDto) {
    const member = await this.requireMembership(userId, true);
    Object.assign(member.company, dto);
    await this.companyRepo.save(member.company);
    return publicCompany(await this.companyRepo.findOneOrFail({ where: { id: member.companyId }, relations: ['wilaya'] }));
  }

  // ── الفريق ──

  async listTeam(userId: string) {
    const member = await this.requireMembership(userId, true);
    const members = await this.memberRepo.find({
      where: { companyId: member.companyId },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });
    return members.map((m) => ({
      id: m.id, role: m.role, isActive: m.isActive, createdAt: m.createdAt,
      user: { id: m.user.id, username: m.user.username, email: m.user.email },
    }));
  }

  /** إضافة موظف بحسابه الموجود (بريده الإلكتروني) */
  async addMember(userId: string, email: string) {
    const owner = await this.requireMembership(userId, true);
    const user = await this.userRepo.findOne({ where: { email: email.trim().toLowerCase() } })
      ?? await this.userRepo.findOne({ where: { email: email.trim() } });
    if (!user) throw new NotFoundException('لا يوجد حساب بهذا البريد — يجب أن يسجّل الموظف أولاً');
    if (user.confirmationAccess !== ConfirmationAccess.GRANTED) {
      throw new ForbiddenException('هذا الحساب ليس لديه صلاحية مؤكّد — يطلبها من تطبيق التأكيد ثم يوافق الأدمن');
    }
    if (await this.memberRepo.findOne({ where: { userId: user.id } })) {
      throw new ConflictException('هذا الحساب عضو في شركة تأكيد مسبقاً');
    }
    const member = await this.memberRepo.save(this.memberRepo.create({
      companyId: owner.companyId, userId: user.id, role: ConfirmationMemberRole.AGENT,
    }));
    return { id: member.id, role: member.role, isActive: member.isActive, user: { id: user.id, username: user.username, email: user.email } };
  }

  async removeMember(userId: string, memberId: string) {
    const owner = await this.requireMembership(userId, true);
    const member = await this.memberRepo.findOne({ where: { id: memberId, companyId: owner.companyId } });
    if (!member) throw new NotFoundException('العضو غير موجود');
    if (member.role === ConfirmationMemberRole.OWNER) throw new BadRequestException('لا يمكن حذف مدير الشركة');

    // طلبات كانت محجوزة له ترجع للقائمة فوراً
    await this.orderRepo.update(
      { confirmationCompanyId: owner.companyId, confirmationAgentId: member.userId },
      { confirmationLockedUntil: null },
    );
    await this.memberRepo.remove(member);
    return { success: true };
  }

  // ── الأرباح (مدير الشركة) ──

  /**
   * محفظة الشركة: الرصيد، رسوم المنصة عن كل طلب مؤكد، وكم تأكيداً يكفي الرصيد.
   * أجر الشركة نفسه يُتفق عليه مع التاجر خارج المنصة.
   */
  async earnings(userId: string) {
    const owner = await this.requireMembership(userId, true);
    const companyId = owner.companyId;
    const ownerId = owner.company.ownerId;
    const fee = await this.billing.fee();

    const [[totals], recent, agents, balance] = await Promise.all([
      this.dataSource.query(
        `SELECT
           COUNT(*) FILTER (WHERE type = 'confirmation_fee') AS "feesCount",
           COALESCE(SUM(amount) FILTER (WHERE type = 'confirmation_fee'), 0) AS "feesTotal",
           COUNT(*) FILTER (WHERE type = 'confirmation_fee' AND "createdAt" >= date_trunc('month', now())) AS "feesCountThisMonth",
           COALESCE(SUM(amount) FILTER (WHERE type = 'confirmation_fee' AND "createdAt" >= date_trunc('month', now())), 0) AS "feesThisMonth",
           COALESCE(SUM(amount) FILTER (WHERE type = 'top_up'), 0) AS "toppedUp"
         FROM "transactions" WHERE "userId" = $1`,
        [ownerId],
      ),
      // آخر حركات المحفظة: شحن ورسوم
      this.dataSource.query(
        `SELECT id, type, action, amount, "createdAt"
           FROM "transactions"
          WHERE "userId" = $1 AND type IN ('top_up', 'confirmation_fee')
          ORDER BY "createdAt" DESC LIMIT 30`,
        [ownerId],
      ),
      // أداء كل موظف: ما أكّده (من السجل)، وكم منه سُلّم
      this.dataSource.query(
        `SELECT u.id, u.username,
                COUNT(DISTINCT l."orderId") FILTER (WHERE l."toStatus" = 'confirmed') AS "confirmed",
                COUNT(DISTINCT l."orderId") FILTER (WHERE l."toStatus" = 'cancelled') AS "cancelled",
                COUNT(DISTINCT l."orderId") FILTER (WHERE l."toStatus" = 'confirmed' AND o.status = 'delivered') AS "delivered"
           FROM "confirmation_logs" l
           JOIN "users" u ON u.id = l."agentId"
           JOIN "orders" o ON o.id = l."orderId"
          WHERE l."companyId" = $1 AND l.action = 'status'
          GROUP BY u.id, u.username
          ORDER BY "confirmed" DESC`,
        [companyId],
      ),
      this.billing.balanceOf(ownerId),
    ]);

    const n = (v: unknown) => Math.round(Number(v ?? 0) * 100) / 100;
    return {
      walletBalance: balance,
      fee,
      confirmationsLeft: fee > 0 ? Math.floor(balance / fee) : null,
      feesCount: Number(totals.feesCount),
      feesTotal: n(totals.feesTotal),
      feesCountThisMonth: Number(totals.feesCountThisMonth),
      feesThisMonth: n(totals.feesThisMonth),
      toppedUp: n(totals.toppedUp),
      recent: recent.map((r: any) => ({ ...r, amount: n(r.amount) })),
      agents: agents.map((a: any) => ({
        id: a.id, username: a.username,
        confirmed: Number(a.confirmed), cancelled: Number(a.cancelled), delivered: Number(a.delivered),
      })),
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // التاجر: البحث والحفظ والإرسال
  // ══════════════════════════════════════════════════════════════════════════

  async directory(search?: string, wilayaId?: number, storeId?: string, userId?: string) {
    const qb = this.companyRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.wilaya', 'wilaya')
      .where('c.status = :status', { status: ConfirmationCompanyStatus.APPROVED })
      .orderBy('c.createdAt', 'DESC')
      .take(100);
    if (search?.trim()) {
      const term = search.trim();
      const digits = term.replace(/\D/g, '');
      qb.leftJoin('c.owner', 'owner').andWhere(new Brackets((w) => {
        w.where('c.name ILIKE :s', { s: `%${term}%` })
          .orWhere('c.description ILIKE :s')
          // البريد بالمطابقة الكاملة فقط — لا نسمح باكتشاف بريد المالكين بالتخمين الجزئي
          .orWhere('LOWER(owner.email) = LOWER(:email)', { email: term });
        // الهاتف: الأرقام فقط، فيطابق "0555 12 34 56" و "0555123456"
        if (digits.length >= 4) {
          w.orWhere(`regexp_replace(c.phone, '\\D', '', 'g') LIKE :phone`, { phone: `%${digits}%` });
        }
      }));
    }
    if (wilayaId) qb.andWhere('c.wilayaId = :wilayaId', { wilayaId });

    const companies = await qb.getMany();

    let savedIds = new Set<string>();
    let blockedIds = new Set<string>();
    if (storeId && userId) {
      await this.storeService.verifyOwnership(storeId, userId);
      const saved = await this.savedRepo.find({ where: { storeId } });
      savedIds = new Set(saved.map((s) => s.companyId));
    }
    if (userId) blockedIds = await this.blockedCompanyIds(userId);
    return companies.map((c) => ({ ...publicCompany(c), saved: savedIds.has(c.id), blocked: blockedIds.has(c.id) }));
  }

  async savedList(storeId: string, userId: string) {
    await this.storeService.verifyOwnership(storeId, userId);
    const saved = await this.savedRepo.find({
      where: { storeId },
      relations: ['company', 'company.wilaya'],
      order: { createdAt: 'DESC' },
    });

    // ملخص طلبات المتجر عند كل شركة
    const stats: Array<{ companyId: string; status: string; count: string }> = await this.orderRepo
      .createQueryBuilder('o')
      .select('o.confirmationCompanyId', 'companyId')
      .addSelect('o.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('o.storeId = :storeId', { storeId })
      .andWhere('o.confirmationCompanyId IS NOT NULL')
      .groupBy('o.confirmationCompanyId')
      .addGroupBy('o.status')
      .getRawMany();

    const blockedIds = await this.blockedCompanyIds(userId);
    return saved.map((s) => {
      const rows = stats.filter((r) => r.companyId === s.companyId);
      const byStatus = Object.fromEntries(rows.map((r) => [r.status, Number(r.count)]));
      return {
        ...publicCompany(s.company), savedAt: s.createdAt, orders: byStatus,
        blocked: blockedIds.has(s.companyId), shippingAccountId: s.shippingAccountId ?? null,
      };
    });
  }

  /**
   * حفظ شركة (أو تغيير حساب التوصيل لشركة محفوظة): حساب التوصيل إجباري —
   * به تُرفع الطلبات التي تؤكدها هذه الشركة.
   */
  async saveCompany(storeId: string, userId: string, companyId: string, shippingAccountId: string) {
    await this.storeService.verifyOwnership(storeId, userId);
    const company = await this.companyRepo.findOne({ where: { id: companyId, status: ConfirmationCompanyStatus.APPROVED } });
    if (!company) throw new NotFoundException('شركة التأكيد غير موجودة');
    if (!(await this.shipping.accountBelongsTo(storeId, userId, shippingAccountId))) {
      throw new BadRequestException('حساب التوصيل غير موجود — أضفه من الإعدادات أولاً');
    }
    await this.savedRepo.upsert({ storeId, companyId, shippingAccountId }, ['storeId', 'companyId']);
    return { success: true, shippingAccountId };
  }

  async unsaveCompany(storeId: string, userId: string, companyId: string) {
    await this.storeService.verifyOwnership(storeId, userId);
    await this.savedRepo.delete({ storeId, companyId });
    // الشركة لم تعد في القائمة: يتوقف الإرسال التلقائي لها
    await this.dataSource.getRepository(Store).update(
      { id: storeId, autoConfirmationCompanyId: companyId },
      { autoConfirmationEnabled: false, autoConfirmationCompanyId: null },
    );
    return { success: true };
  }

  /**
   * إرسال طلبات محددة لشركة من قائمة التاجر. أجر الشركة يتفق عليه التاجر معها
   * خارج المنصة — لا شيء يُخصم من محفظة التاجر.
   */
  async sendOrders(storeId: string, userId: string, companyId: string, orderIds: string[]) {
    await this.storeService.verifyOwnership(storeId, userId);
    return this.dispatchOrders(storeId, companyId, orderIds);
  }

  // نفس شروط الإرسال اليدوي (الشركة في القائمة ومقبولة، الرصيد، الطلبات المؤهلة) —
  // يستعملها الإرسال اليدوي بعد التحقق من الملكية، والإرسال التلقائي للطلبات الجديدة
  private async dispatchOrders(storeId: string, companyId: string, orderIds: string[]) {
    const saved = await this.savedRepo.findOne({ where: { storeId, companyId }, relations: ['company'] });
    if (!saved) throw new BadRequestException('أضف الشركة إلى قائمتك أولاً');
    if (saved.company.status !== ConfirmationCompanyStatus.APPROVED) {
      throw new BadRequestException('شركة التأكيد غير متاحة حالياً');
    }
    if (isPausedNow(saved.company)) {
      throw new BadRequestException({ message: 'شركة التأكيد متوقفة مؤقتاً عن استقبال الطلبات', code: 'company_paused' });
    }
    const store = await this.dataSource.getRepository(Store).findOne({ where: { id: storeId }, relations: ['user'] });
    if (await this.blockedRepo.exists({ where: { companyId, merchantId: store!.user.id } })) {
      throw new BadRequestException({ message: 'شركة التأكيد أوقفت استقبال طلباتك', code: 'merchant_blocked' });
    }

    const orders = await this.orderRepo.find({ where: { id: In(orderIds), storeId } });
    const skipped: Array<{ id: string; reason: string }> = [];
    const eligible = orders.filter((o) => {
      if (o.confirmationCompanyId) { skipped.push({ id: o.id, reason: 'already_sent' }); return false; }
      // الطلبية الرقمية لا توصيل لها: لا تأكيد عبر شركة ولا عمولة
      if (o.isDigital) { skipped.push({ id: o.id, reason: 'digital' }); return false; }
      if (!QUEUE_STATUSES.includes(o.status)) { skipped.push({ id: o.id, reason: 'status' }); return false; }
      return true;
    });
    orderIds.filter((id) => !orders.some((o) => o.id === id)).forEach((id) => skipped.push({ id, reason: 'not_found' }));
    if (!eligible.length) return { sent: 0, skipped };

    const ids = eligible.map((o) => o.id);
    await this.dataSource.transaction(async (manager) => {
      await manager
        .createQueryBuilder()
        .update(Order)
        .set({
          confirmationCompanyId: companyId,
          confirmationAgentId: null,
          confirmationSentAt: () => 'now()',
          confirmationLockedUntil: null,
          confirmationNextAttemptAt: null,
          // رسوم المنصة تُخصم من محفظة الشركة عند التأكيد (ConfirmationBillingService)
          confirmationCommission: null,
          confirmationPlatformRate: null,
          confirmationPaidAt: null,
        })
        .where('id IN (:...ids)', { ids })
        .andWhere('"confirmationCompanyId" IS NULL')
        .execute();
      await manager.save(eligible.map((o) => manager.create(ConfirmationLog, {
        orderId: o.id, companyId, agentId: null, action: ConfirmationAction.SENT, fromStatus: o.status,
      })));
    });

    return { sent: ids.length, skipped };
  }

  // ── مدير الشركة: الإيقاف المؤقت وإيقاف تاجر ──

  private async blockedCompanyIds(merchantId: string) {
    const rows = await this.blockedRepo.find({ where: { merchantId }, select: ['companyId'] });
    return new Set(rows.map((r) => r.companyId));
  }

  /** until: تاريخ الاستئناف التلقائي (اختياري) — بدونه تبقى متوقفة حتى الاستئناف اليدوي */
  async setPause(userId: string, paused: boolean, until?: string | null) {
    const owner = await this.requireMembership(userId, true);
    let pausedUntil: Date | null = null;
    if (paused && until) {
      pausedUntil = new Date(until);
      if (Number.isNaN(pausedUntil.getTime()) || pausedUntil.getTime() <= Date.now()) {
        throw new BadRequestException('اختر تاريخاً قادماً لانتهاء التوقف');
      }
    }
    await this.companyRepo.update(owner.companyId, { isPaused: paused, pausedUntil });
    const company = await this.companyRepo.findOne({ where: { id: owner.companyId }, relations: ['wilaya'] });
    return publicCompany(company!);
  }

  /** التجار الذين حفظوا الشركة أو أرسلوا لها طلبات — مع حالة الإيقاف */
  async clients(userId: string) {
    const owner = await this.requireMembership(userId, true);
    const rows: any[] = await this.dataSource.query(
      `SELECT u.id, u.username,
              array_agg(DISTINCT s.name) AS stores,
              (SELECT COUNT(*) FROM "orders" o JOIN "stores" s2 ON s2.id = o."storeId"
                WHERE s2."userId" = u.id AND o."confirmationCompanyId" = $1) AS "ordersCount",
              EXISTS (SELECT 1 FROM "confirmation_blocked_merchants" b
                       WHERE b."companyId" = $1 AND b."merchantId" = u.id) AS blocked
         FROM "stores" s
         JOIN "users" u ON u.id = s."userId"
        WHERE s.id IN (SELECT "storeId" FROM "store_confirmation_companies" WHERE "companyId" = $1
                       UNION SELECT "storeId" FROM "orders" WHERE "confirmationCompanyId" = $1)
        GROUP BY u.id, u.username
        ORDER BY blocked DESC, "ordersCount" DESC`,
      [owner.companyId],
    );
    return rows.map((r) => ({
      id: r.id, username: r.username, stores: r.stores ?? [], ordersCount: Number(r.ordersCount), blocked: !!r.blocked,
    }));
  }

  /** الإيقاف لا يمس الطلبات الموجودة عند الشركة — يمنع فقط الإرسال الجديد (يدوي وتلقائي) */
  async setMerchantBlocked(userId: string, merchantId: string, blocked: boolean) {
    const owner = await this.requireMembership(userId, true);
    if (blocked) {
      const known = await this.dataSource.query(
        `SELECT 1 FROM "stores" s
          WHERE s."userId" = $2 AND s.id IN (SELECT "storeId" FROM "store_confirmation_companies" WHERE "companyId" = $1
                                             UNION SELECT "storeId" FROM "orders" WHERE "confirmationCompanyId" = $1)
          LIMIT 1`,
        [owner.companyId, merchantId],
      );
      if (!known.length) throw new NotFoundException('التاجر غير موجود في قائمة عملائك');
      await this.blockedRepo.upsert({ companyId: owner.companyId, merchantId }, ['companyId', 'merchantId']);
    } else {
      await this.blockedRepo.delete({ companyId: owner.companyId, merchantId });
    }
    return { merchantId, blocked };
  }

  // ── الإرسال التلقائي للطلبات الجديدة ──

  async getAutoSend(storeId: string, userId: string) {
    await this.storeService.verifyOwnership(storeId, userId);
    const store = await this.dataSource.getRepository(Store).findOne({
      where: { id: storeId },
      select: ['id', 'autoConfirmationEnabled', 'autoConfirmationCompanyId'],
    });
    return { enabled: !!store?.autoConfirmationEnabled, companyId: store?.autoConfirmationCompanyId ?? null };
  }

  async setAutoSend(storeId: string, userId: string, enabled: boolean, companyId?: string | null) {
    await this.storeService.verifyOwnership(storeId, userId);
    if (enabled) {
      if (!companyId) throw new BadRequestException('اختر شركة التأكيد');
      const saved = await this.savedRepo.findOne({ where: { storeId, companyId }, relations: ['company'] });
      if (!saved) throw new BadRequestException('أضف الشركة إلى قائمتك أولاً');
      if (saved.company.status !== ConfirmationCompanyStatus.APPROVED) {
        throw new BadRequestException('شركة التأكيد غير متاحة حالياً');
      }
    }
    await this.dataSource.getRepository(Store).update(storeId, {
      autoConfirmationEnabled: enabled,
      autoConfirmationCompanyId: enabled ? companyId! : (companyId ?? null),
    });
    return this.getAutoSend(storeId, userId);
  }

  /**
   * يُستدعى بعد إنشاء طلب جديد: إذا فعّل المتجر الإرسال التلقائي يذهب الطلب لشركته.
   * لا يرمي أبداً — أي فشل (رصيد غير كافٍ، شركة موقوفة...) يُسجَّل ويبقى الطلب عند التاجر.
   */
  async autoSendNewOrder(storeId: string, orderId: string) {
    try {
      const store = await this.dataSource.getRepository(Store).findOne({
        where: { id: storeId },
        select: ['id', 'autoConfirmationEnabled', 'autoConfirmationCompanyId'],
      });
      if (!store?.autoConfirmationEnabled || !store.autoConfirmationCompanyId) return;
      const result = await this.dispatchOrders(storeId, store.autoConfirmationCompanyId, [orderId]);
      if (!result.sent) this.logger.warn(`Auto-send skipped order ${orderId}: ${JSON.stringify(result.skipped)}`);
    } catch (err: any) {
      this.logger.warn(`Auto-send failed for order ${orderId}: ${err?.response?.message ?? err?.message}`);
    }
  }

  /** سحب طلبات من الشركة — ما دامت تنتظر التأكيد وليست بيد موظف الآن */
  async recallOrders(storeId: string, userId: string, orderIds: string[]) {
    await this.storeService.verifyOwnership(storeId, userId);
    // "ليس بيد موظف الآن" يُحسب في قاعدة البيانات (now()) لتفادي فرق المنطقة الزمنية
    const recallable = await this.orderRepo
      .createQueryBuilder('o')
      .where('o.id IN (:...orderIds)', { orderIds })
      .andWhere('o.storeId = :storeId', { storeId })
      .andWhere('o.confirmationCompanyId IS NOT NULL')
      // قبل التأكيد، أو إذا ألغتها الشركة — بعد التأكيد لا استرجاع (عمولة الشركة)
      .andWhere('o.status IN (:...statuses)', { statuses: [...QUEUE_STATUSES, StatusEnum.CANCELLED] })
      .andWhere('(o.confirmationLockedUntil IS NULL OR o.confirmationLockedUntil <= now())')
      .getMany();
    if (!recallable.length) return { recalled: 0 };

    await this.dataSource.transaction(async (manager) => {
      await manager.update(Order, { id: In(recallable.map((o) => o.id)) }, {
        confirmationCompanyId: null,
        confirmationAgentId: null,
        confirmationSentAt: null,
        confirmationLockedUntil: null,
        confirmationNextAttemptAt: null,
        confirmationCommission: null,
        confirmationPlatformRate: null,
      });
      await manager.save(recallable.map((o) => manager.create(ConfirmationLog, {
        orderId: o.id, companyId: o.confirmationCompanyId!, agentId: null, action: ConfirmationAction.RECALLED, fromStatus: o.status,
      })));
    });
    return { recalled: recallable.length };
  }

  /** سجل التأكيد لطلب واحد (للتاجر) */
  async orderLog(storeId: string, userId: string, orderId: string) {
    await this.storeService.verifyOwnership(storeId, userId);
    const order = await this.orderRepo.findOne({ where: { id: orderId, storeId } });
    if (!order) throw new NotFoundException('الطلب غير موجود');
    return this.logsWithAgents({ orderId });
  }

  async logsWithAgents(where: Record<string, unknown>, take = 100) {
    const logs = await this.logRepo.find({ where, order: { createdAt: 'DESC' }, take });
    const agentIds = [...new Set(logs.map((l) => l.agentId).filter(Boolean))] as string[];
    const agents = agentIds.length ? await this.userRepo.find({ where: { id: In(agentIds) }, select: ['id', 'username'] }) : [];
    return logs.map((l) => ({
      id: l.id, orderId: l.orderId, action: l.action, fromStatus: l.fromStatus ?? null, toStatus: l.toStatus ?? null,
      note: l.note ?? null, createdAt: l.createdAt,
      agent: l.agentId ? { id: l.agentId, username: agents.find((a) => a.id === l.agentId)?.username ?? null } : null,
    }));
  }

  // ══════════════════════════════════════════════════════════════════════════
  // مدير المنصة (SuperAdminGuard في الـ controller)
  // ══════════════════════════════════════════════════════════════════════════

  async adminAccessList(access?: ConfirmationAccess) {
    const users = await this.userRepo.find({
      where: { confirmationAccess: access ?? In([ConfirmationAccess.REQUESTED, ConfirmationAccess.GRANTED, ConfirmationAccess.REVOKED]) },
      select: ['id', 'username', 'email', 'phone', 'confirmationAccess', 'createdAt'],
      order: { createdAt: 'DESC' },
      take: 300,
    });
    const members = users.length
      ? await this.memberRepo.find({ where: { userId: In(users.map((u) => u.id)) }, relations: ['company'] })
      : [];
    return users.map((u) => {
      const m = members.find((x) => x.userId === u.id);
      return {
        id: u.id, username: u.username, email: u.email, phone: u.phone ?? null,
        access: u.confirmationAccess, createdAt: u.createdAt,
        company: m ? { id: m.company.id, name: m.company.name, role: m.role } : null,
      };
    });
  }

  async adminSetAccess(targetId: string, access: ConfirmationAccess) {
    const target = await this.userRepo.findOne({ where: { id: targetId }, select: ['id'] });
    if (!target) throw new NotFoundException('المستخدم غير موجود');
    await this.userRepo.update(targetId, { confirmationAccess: access });
    if (access === ConfirmationAccess.REVOKED) {
      // طلب كان بيده يرجع للقائمة فوراً
      await this.orderRepo.update({ confirmationAgentId: targetId }, { confirmationLockedUntil: null });
    }
    return { id: targetId, access };
  }

  async adminList(status?: ConfirmationCompanyStatus) {
    const companies = await this.companyRepo.find({
      where: status ? { status } : {},
      relations: ['wilaya', 'owner'],
      order: { createdAt: 'DESC' },
      take: 200,
    });
    return companies.map((c) => ({
      ...publicCompany(c),
      owner: { id: c.owner.id, username: c.owner.username, email: c.owner.email },
    }));
  }

  async adminSetStatus(companyId: string, status: ConfirmationCompanyStatus) {
    const company = await this.companyRepo.findOne({ where: { id: companyId } });
    if (!company) throw new NotFoundException('شركة التأكيد غير موجودة');
    company.status = status;
    await this.companyRepo.save(company);
    return { id: company.id, status: company.status };
  }
}
