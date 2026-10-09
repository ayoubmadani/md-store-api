import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ILike, In, Like, Repository } from "typeorm";
import { v4 as uuidv4 } from 'uuid';

import { CreateOrderDto } from "./dto/create-order.dto";
import { UpdateOrderDto } from "./dto/update-order.dto";
import { Order, StatusEnum, TypeShipEnum } from "./entities/order.entity";
import { OrderItem } from "./entities/order-item.entity";
import { Product } from "../product/entities/product.entity";
import { Store } from "../store/entities/store.entity";
import { NtfyService } from "../ntfy/ntfy.service";
import { Shipping } from "../shipping/entity/shipping.entity";
import { ConfirmationBillingService } from "../confirmation/confirmation-billing.service";

@Injectable()
export class OrdersService {
    constructor(
        @InjectRepository(Order) private readonly ordersRepo: Repository<Order>,
        @InjectRepository(OrderItem) private readonly itemsRepo: Repository<OrderItem>,
        @InjectRepository(Product) private readonly productsRepo: Repository<Product>,
        @InjectRepository(Store) private readonly storesRepo: Repository<Store>,
        @InjectRepository(Shipping) private readonly shippingRepo: Repository<Shipping>,

        private readonly ntfyService: NtfyService,
        private readonly confirmationBilling: ConfirmationBillingService,
    ) { }

    // ─── helpers ──────────────────────────────────────────────────────────────

    private fmt = (name: string, limit = 15) =>
        name.length > limit ? name.slice(0, limit) + '...' : name;

    // ─── CREATE ───────────────────────────────────────────────────────────────

    /**
     * يقبل طلباً مفرداً أو مصفوفة طلبات (سلة كاملة).
     * ينشئ سجل Order واحد + N سجلات OrderItem.
     */
    async create(dtos: CreateOrderDto | CreateOrderDto[]) {
        const data: CreateOrderDto[] = Array.isArray(dtos) ? dtos : [dtos];
        if (!data.length) throw new BadRequestException('No data provided');

        const first = data[0];

        const store = first.domain
            ? await this.storesRepo.findOne({ where: { subdomain: first.domain } })
            : await this.storesRepo.findOne({ where: { id: first.storeId } });

        if (!store) throw new BadRequestException('Store not found');

        const storeId = store.id;

        // منتج رقمي vs عادي — يُحدَّد من المنتجات الفعلية في قاعدة البيانات
        // (لا يُوثَق بما يرسله العميل)، ولا يجوز خلط النوعين في طلب واحد
        // لأن الطلب سجل واحد بعميل/شحن واحد فقط.
        const products = await this.productsRepo.find({
            where: { id: In(data.map(d => d.productId)) },
            relations: ['offers', 'variantDetails'],
        });

        // عرض أو متغير عطّله التاجر من صفحة المنتج لا يُقبل في طلب جديد
        // (قد يبقى ظاهراً في صفحة مفتوحة قديماً لدى الزائر)
        for (const d of data) {
            const product = products.find(p => p.id === d.productId);
            const offerId = d.offerId ?? d.selectedOffer;
            if (offerId && product?.offers.some(o => o.id === offerId && !o.isActive)) {
                throw new BadRequestException('هذا العرض لم يعد متاحاً');
            }
            if (d.variantDetailId && product?.variantDetails.some(v => v.id === d.variantDetailId && !v.isActive)) {
                throw new BadRequestException('هذا الاختيار لم يعد متاحاً');
            }
        }

        const isDigital = products.some(p => p.isDigital);
        if (products.some(p => p.isDigital) !== products.every(p => p.isDigital)) {
            throw new BadRequestException('لا يمكن الجمع بين منتج رقمي ومنتج عادي في نفس الطلب');
        }
        // الزائر يختار طريقة تواصل واحدة (بريد أو واتساب) — إحداهما فقط مطلوبة
        if (isDigital && !first.customerEmail?.trim() && !first.customerWhatsapp?.trim()) {
            throw new BadRequestException('يجب إدخال البريد الإلكتروني أو رقم الواتساب لطلب منتج رقمي');
        }

        const shipPrice = isDigital ? 0 : Number(first.priceShip ?? first.priceLivraison ?? 0);

        // حساب إجمالي السعر من الـ dtos
        const totalItemsPrice = data.reduce((sum, d) => {
            const price = Number(d.finalPrice ?? d.totalPrice ?? 0);
            const qty = d.quantity ?? 1;
            return sum + (price * qty);
        }, 0);

        const order = this.ordersRepo.create({
            cartId: uuidv4(),
            storeId,
            customerId: first.customerId || uuidv4(),
            customerName: first.customerName,
            customerPhone: first.customerPhone,
            customerEmail: first.customerEmail,
            customerWhatsapp: first.customerWhatsapp,
            customerWilayaId: isDigital ? undefined : (first.customerWilayaId ?? first.customerWelaya),
            customerCommuneId: isDigital ? undefined : (first.customerCommuneId ?? first.customerCommune),
            priceShip: shipPrice,
            priceLoss: Number(first.priceLoss ?? 0),
            typeShip: first.typeShip ?? first.typeLivraison ?? TypeShipEnum.HOME,
            totalPrice: totalItemsPrice, // استخدام المجموع المحسوب
            status: StatusEnum.PENDING,
            platform: first.platform ?? 'mdstore',
            lpId: first.lpId,
            builderPageId: first.builderPageId,
            isDigital,
        });

        const savedOrder = await this.ordersRepo.save(order);

        const items = data.map(dto => {
            const fp = Number(dto.finalPrice ?? dto.totalPrice ?? 0);
            const qty = dto.quantity ?? 1;

            return this.itemsRepo.create({
                order: savedOrder,
                productId: dto.productId,
                quantity: qty,
                finalPrice: fp,
                totalPrice: fp * qty,
                variantDetailId: dto.variantDetailId,
                offerId: dto.offerId ?? dto.selectedOffer,
                unityPrice: dto.unityPrice
            });
        });

        await this.itemsRepo.save(items);

        // إرسال الإشعارات
        this.sendNotification(savedOrder, data).catch(console.error);

        // مهم: إرجاع الطلب مع الـ relations لضمان ظهور الـ items في الفرونت إند
        return this.getOne(savedOrder.id);
    }

    // ─── GET ALL ──────────────────────────────────────────────────────────────

    async getAllOrdersByStoreId(
        storeId: string,
        status?: StatusEnum,
        query?: string,
        page: number = 1,
        isDigital?: boolean,
    ) {
        const limit = 50;
        const skip = (page - 1) * limit;

        const qb = this.ordersRepo
            .createQueryBuilder('o')
            .leftJoinAndSelect('o.items', 'item')
            .leftJoinAndSelect('item.product', 'product')
            .leftJoinAndSelect('product.imagesProduct', 'img')
            .leftJoinAndSelect('item.variantDetail', 'vd')
            .leftJoinAndSelect('item.offer', 'offer')
            .leftJoinAndSelect('o.customerWilaya', 'wilaya')
            .leftJoinAndSelect('o.customerCommune', 'commune')
            // اسم شركة التأكيد التي أُرسل لها الطلب (إن وُجدت) — للعرض في القائمة
            .leftJoin('o.confirmationCompany', 'cc')
            .addSelect(['cc.id', 'cc.name'])
            .where('o.storeId = :storeId', { storeId })
            .orderBy('o.createdAt', 'DESC')
            .addOrderBy('img.order', 'ASC')
            .take(limit)
            .skip(skip);

        if (status) qb.andWhere('o.status = :status', { status });
        if (isDigital !== undefined) qb.andWhere('o.isDigital = :isDigital', { isDigital });

        if (query) {
            const s = `%${query}%`;
            qb.andWhere(
                '(o.customerName ILIKE :s OR o.customerPhone LIKE :s)',
                { s },
            );
        }

        return qb.getMany();
    }

    async getCountPageByStoreId(storeId: string, status?: StatusEnum, query?: string, isDigital?: boolean) {
        const qb = this.ordersRepo
            .createQueryBuilder('o')
            .select('COUNT(o.id)', 'count')
            .where('o.storeId = :storeId', { storeId });

        if (status) qb.andWhere('o.status = :status', { status });
        if (isDigital !== undefined) qb.andWhere('o.isDigital = :isDigital', { isDigital });

        if (query) {
            const s = `%${query}%`;
            qb.andWhere(
                '(o.customerName ILIKE :s OR o.customerPhone LIKE :s)',
                { s },
            );
        }

        const result = await qb.getRawOne();
        return Number(result?.count ?? 0);
    }

    // ─── GET ONE ──────────────────────────────────────────────────────────────

    async getOne(orderId: string) {
        const order = await this.ordersRepo.findOne({
            where: { id: orderId },
            relations: [
                'items', 'items.product', 'items.product.imagesProduct',
                'items.variantDetail', 'items.offer',
                'customerWilaya', 'customerCommune', 'store.user', 'confirmationCompany',
            ],
            order: { items: { product: { imagesProduct: { order: 'ASC' } } } },
        });

        console.log(order);
        

        return order
    }

    // ─── UPDATE ───────────────────────────────────────────────────────────────

    /**
     * يقبل DTO مفرداً أو مصفوفة (per-item).
     * البيانات المشتركة (customer/ship/status) تُؤخذ من أول عنصر.
     * البيانات الخاصة بكل item (qty/offer/variant/price) تُؤخذ حسب الـ index.
     */
    /**
     * طلبية أُرسلت لشركة تأكيد:
     * - قبل أن تؤكدها الشركة (أو إذا ألغتها): مقفلة — التاجر يسترجعها أولاً.
     * - بعد التأكيد: لا استرجاع، والتاجر يستطيع فقط وضعها "قيد الشحن".
     *   "مسلّم" و"مرتجع" (اللذان يحددان العمولة) يأتيان من شركة التوصيل عبر
     *   رقم التتبع — فلا يستطيع التاجر التهرب من العمولة أو أخذها خطأً.
     * يرجع 'free' (بلا قيود) أو 'shippingOnly'.
     */
    private merchantEditMode(order: Order, newStatus?: StatusEnum): 'free' | 'shippingOnly' {
        if (!order.confirmationCompanyId) return 'free';
        const afterConfirmation = [StatusEnum.CONFIRMED, StatusEnum.SHIPPING, StatusEnum.DELIVERED, StatusEnum.RETURNED];
        const shippingPhase = [StatusEnum.SHIPPING];
        if (!afterConfirmation.includes(order.status)) {
            throw new ForbiddenException('الطلبية عند شركة التأكيد — استرجعها أولاً لتعديلها');
        }
        if (!newStatus || newStatus === order.status || !shippingPhase.includes(newStatus)) {
            throw new ForbiddenException('أكدتها شركة التأكيد — يمكن فقط وضعها "قيد الشحن"؛ التسليم والإرجاع يأتيان من شركة التوصيل');
        }
        return 'shippingOnly';
    }

    async updateInfoUser(orderId: string, dto: CreateOrderDto | CreateOrderDto[]) {
    // التأكد من التعامل مع مصفوفة حتى لو أرسل المستخدم كائناً واحداً
    const dtos = Array.isArray(dto) ? dto : [dto];
    const first = dtos[0];

    // جلب الطلب الأصلي مع عناصره
    const order = await this.ordersRepo.findOne({
        where: { id: orderId },
        relations: ['items'],
    });
    if (!order) throw new NotFoundException('Order not found');

    // طلبية أكدتها شركة تأكيد: الحالة فقط، بدون أي تعديل آخر
    if (this.merchantEditMode(order, first['status'] as StatusEnum) === 'shippingOnly') {
        await this.ordersRepo.update(order.id, { status: first['status'] as StatusEnum });
        await this.confirmationBilling.settleIfDelivered(order.id);
        return this.getOne(order.id);
    }

    // 1. تحديث بيانات الطلب الأساسية (من الحقول الموجودة في أول عنصر في المصفوفة)
    await this.ordersRepo.update(order.id, {
        customerName: first.customerName ?? order.customerName,
        customerPhone: first.customerPhone ?? order.customerPhone,
        customerEmail: first.customerEmail ?? order.customerEmail,
        customerWhatsapp: first.customerWhatsapp ?? order.customerWhatsapp,
        customerWilayaId: first.customerWilayaId ?? first.customerWelaya ?? order.customerWilayaId,
        customerCommuneId: first.customerCommuneId ?? first.customerCommune ?? order.customerCommuneId,
        typeShip: first.typeShip ?? first.typeLivraison ?? order.typeShip,
        priceShip: Number(first.priceShip ?? first.priceLivraison ?? order.priceShip ?? 0),
        status: (first['status'] ?? order.status) as any, // تحديث الحالة إذا تم إرسالها
    });

    // 2. حذف العناصر القديمة لمزامنة السلة بالكامل (Add/Delete support)
    await this.itemsRepo.delete({ order: { id: order.id } });

    let totalCartPrice = 0;

    // 3. إنشاء العناصر الجديدة (OrderItem) وتصفية حقول الـ DTO الزائدة
    const newItems = dtos.map(d => {
        const fp = Number(d.finalPrice ?? 0);
        const qty = Number(d.quantity ?? 1);
        totalCartPrice += fp * qty;

        // اختيار حقول OrderItem فقط لتجنب خطأ "property does not exist"
        return this.itemsRepo.create({
            productId: d.productId,
            quantity: qty,
            finalPrice: fp,
            totalPrice: fp * qty,
            // معالجة الحقول الاختيارية والأسماء البديلة الموجودة في الـ DTO الخاص بك
            offerId: d.offerId || d.selectedOffer || undefined,
            variantDetailId: d.variantDetailId || (d.variantId as string) || undefined,
            unityPrice: d.unityPrice ?? undefined,
            order: { id: order.id } 
        });
    });

    // حفظ جميع العناصر الجديدة في قاعدة البيانات
    await this.itemsRepo.save(newItems);

    // 4. تحديث الإجمالي النهائي للطلب (سعر المنتجات + سعر الشحن)
    const currentPriceShip = Number(first.priceShip ?? first.priceLivraison ?? order.priceShip ?? 0);
    await this.ordersRepo.update(order.id, { 
        totalPrice: totalCartPrice + currentPriceShip 
    });

    // طلب أُرسل لشركة تأكيد وأصبح مسلَّماً → دفع عمولتها (لا يدفع مرتين)
    await this.confirmationBilling.settleIfDelivered(order.id);

    // إرجاع الطلب المحدث بالكامل
    return this.getOne(order.id);
}

    // ─── GOOGLE SHEETS SYNC ───────────────────────────────────────────────────

    /**
     * طلبات المتجر المُنشأة منذ `since` (شاملة — السكربت يتجاهل المكرر بالمعرّف)،
     * مسطّحة إلى حقول جاهزة لسطر في الجدول.
     */
    async getOrdersForSheet(storeId: string, since?: Date, limit = 200) {
        const take = Math.min(Math.max(limit || 200, 1), 500);
        const qb = this.ordersRepo
            .createQueryBuilder('o')
            .leftJoinAndSelect('o.items', 'item')
            .leftJoinAndSelect('item.product', 'product')
            .leftJoinAndSelect('item.variantDetail', 'vd')
            .leftJoinAndSelect('item.offer', 'offer')
            .leftJoinAndSelect('o.customerWilaya', 'wilaya')
            .leftJoinAndSelect('o.customerCommune', 'commune')
            .leftJoinAndSelect('o.lp', 'lp')
            .leftJoinAndSelect('o.builderPage', 'bp')
            .where('o.storeId = :storeId', { storeId })
            .orderBy('o.createdAt', 'ASC')
            .take(take);
        // تداخل ساعة إلى الوراء: طلب أُنشئ قبل آخر مزامنة لكن لم يُثبَّت (commit)
        // إلا بعدها لن يضيع، وكذلك أي فرق توقيت بين الخادم وقاعدة البيانات.
        // السكربت يتجاهل الطلبات التي عنده بالمعرّف.
        if (since) qb.andWhere('o.createdAt >= :since', { since: new Date(since.getTime() - 60 * 60 * 1000) });

        const orders = await qb.getMany();

        const describeItem = (item: OrderItem) => {
            const options = Array.isArray(item.variantDetail?.name)
                ? item.variantDetail.name
                    .map((e: any) => (e.displayMode === 'image' ? e.attrName : `${e.attrName}: ${e.value}`))
                    .join(' / ')
                : '';
            return [
                `${item.quantity}× ${item.product?.name ?? ''}`,
                options && `(${options})`,
                item.offer?.name && `[${item.offer.name}]`,
            ].filter(Boolean).join(' ');
        };

        return {
            limit: take,
            orders: orders.map((o) => {
                const itemsTotal = (o.items ?? []).reduce((s, it) => s + Number(it.totalPrice || 0), 0);
                return {
                    id: o.id,
                    createdAt: o.createdAt,
                    status: o.status,
                    customerName: o.customerName,
                    customerPhone: o.customerPhone,
                    customerWhatsapp: o.customerWhatsapp ?? null,
                    customerEmail: o.customerEmail ?? null,
                    wilaya: o.customerWilaya?.ar_name ?? null,
                    commune: o.customerCommune?.ar_name ?? null,
                    typeShip: o.isDigital ? null : o.typeShip,
                    isDigital: o.isDigital,
                    products: (o.items ?? []).map(describeItem).join(' + '),
                    itemsTotal,
                    priceShip: Number(o.priceShip || 0),
                    total: itemsTotal + Number(o.priceShip || 0),
                    source: o.lp ? String(o.lp.domain) : o.builderPage ? (o.builderPage.domain || o.builderPage.name) : (o.platform ?? null),
                };
            }),
        };
    }

    async setStatusFromSheet(storeId: string, orderId: string, status: StatusEnum) {
        const order = await this.ordersRepo.findOne({ where: { id: orderId, storeId } });
        if (!order) throw new NotFoundException('Order not found');
        this.merchantEditMode(order, status);
        await this.ordersRepo.update(order.id, { status });
        await this.confirmationBilling.settleIfDelivered(order.id);
        return { id: order.id, status };
    }

    // ─── STATUS COUNTS ────────────────────────────────────────────────────────

    async getCountStatus(storeId: string) {
        return this.ordersRepo
            .createQueryBuilder('o')
            .select('o.status', 'status')
            .addSelect('COUNT(o.id)', 'count')
            .where('o.storeId = :storeId', { storeId })
            .groupBy('o.status')
            .getRawMany();
    }

    // ─── DELETE ───────────────────────────────────────────────────────────────

    async delete(orderId: string) {
        const order = await this.ordersRepo.findOne({ where: { id: orderId } });
        if (!order) throw new NotFoundException('Order not found');
        if (order.confirmationCompanyId) {
            throw new ForbiddenException('لا يمكن حذف طلبية أُرسلت لشركة تأكيد');
        }
        // الـ items تُحذف تلقائياً بسبب onDelete: CASCADE على الـ entity
        return this.ordersRepo.remove(order);
    }

    // ─── NOTIFICATION ─────────────────────────────────────────────────────────

    private async sendNotification(order: Order, dtos: CreateOrderDto[]) {
        const first = dtos[0];
        try {
            const product = await this.productsRepo.findOne({
                where: { id: first.productId },
                relations: ['store.user'],
            });

            const topic = product?.store?.user?.topic;
            const isNtfy = product?.store?.user?.isNtfy;
            if (!isNtfy || !topic) return;

            const shipping = await this.shippingRepo.findOne({
                where: { wilaya: { id: order.customerWilayaId } },
                relations: ['wilaya'],
            });

            const names = await Promise.all(
                dtos.map(async d => {
                    const p = await this.productsRepo.findOne({ where: { id: d.productId } });
                    return `- ${this.fmt(p?.name || 'منتج')} (x${d.quantity ?? 1})`;
                }),
            );

            const msg = `🛒 طلبية جديدة: ${order.platform ?? 'mdstore'}
-------------------------
👤 العميل: ${order.customerName}
📍 الولاية: ${shipping?.wilaya?.name || 'غير محددة'}
📞 الهاتف: ${order.customerPhone}
🛍️ المنتجات:
${names.join('\n')}
🚚 التوصيل: ${order.typeShip}
💰 الإجمالي: ${Number(order.totalPrice) + Number(order.priceShip)} دج`.trim();

            this.ntfyService.publish(topic, msg);
        } catch (e) {
            console.error('Notification error:', e);
        }
    }
}