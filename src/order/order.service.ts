import { BadRequestException, Injectable, NotAcceptableException, NotFoundException } from "@nestjs/common";
import { CreateOrderDto } from "./dto/create-order.dto";
import { ILike, Like, Repository } from "typeorm";
import { Order, StatusEnum, TypeShipEnum } from "./entities/order.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { Product } from "../product/entities/product.entity";
import { Store } from "../store/entities/store.entity";
import { Offer } from "../product/entities/offer.entity";
import { VariantDetail } from "../product/entities/variant-detail.entity";
import { v4 as uuidv4 } from 'uuid';
import { UpdateOrderDto } from "./dto/update-order.dto";
import { NtfyService } from "../ntfy/ntfy.service";
import { Wilaya } from "../shipping/entity/wilaya.entity";
import { Shipping } from "../shipping/entity/shipping.entity";
import { Commune } from "../shipping/entity/commune.entity";



@Injectable()
export class OrdersService {
    constructor(
        @InjectRepository(Order) private readonly ordersrepo: Repository<Order>,
        @InjectRepository(Product) private readonly productsrepo: Repository<Product>,
        @InjectRepository(Store) private readonly storesrepo: Repository<Store>,
        @InjectRepository(Offer) private readonly offersrepo: Repository<Offer>,
        @InjectRepository(VariantDetail) private readonly variantDetailsrepo: Repository<VariantDetail>,
        @InjectRepository(Shipping) private readonly shippingrepo: Repository<Shipping>,
        @InjectRepository(Commune) private readonly communerepo: Repository<Commune>,

        private readonly ntfyService: NtfyService
    ) { }

    formatName = (name: string, limit: number = 15) => {
        return name.length > limit ? name.substring(0, limit) + '...' : name;
    };



    async create(dto: CreateOrderDto) {
        const store = await this.storesrepo.findOne({ where: { subdomain: dto.domain } });
        if (!store) {
            throw new BadRequestException('Store not exist');
        }

        console.log(dto);


        const order = this.ordersrepo.create({
            customerId: dto.customerId || uuidv4(),
            customerName: dto.customerName,
            customerPhone: dto.customerPhone,
            customerWilayaId: dto.customerWilayaId || dto.customerWelaya,
            customerCommuneId: dto.customerCommuneId || dto.customerCommune,
            productId: dto.productId,
            storeId: dto.storeId,
            priceShip: dto.priceShip || dto.priceLivraison || 0,
            priceLoss: dto.priceLoss || 0,
            typeShip: dto.typeShip || dto.typeLivraison || TypeShipEnum.HOME,
            totalPrice: dto.totalPrice,
            quantity: dto.quantity || 1,
            variantDetailId: dto.variantDetailId,
            offerId: dto.offerId,
            platform: dto.platform || "mdstore",
            lpId: dto.lpId
        } as any);

        const savedOrder = await this.ordersrepo.save(order);

        const product = await this.productsrepo.findOne({
            where: { id: dto.productId },
            relations: ['store.user']
        });

        const shipping = await this.shippingrepo.findOne({
            where: { wilaya: { id: dto.customerWilayaId || dto.customerWelaya } },
            relations: ['wilaya']
        })

        const communes = await this.communerepo.findOne({
            where: { id: dto.customerCommuneId || dto.customerCommune },
        })


        const productName = product?.name || "منتج غير محدد"; // تأكد من إزالة أي مرجع هنا
        const topic = product?.store?.user?.topic;
        const isNtfy = product?.store?.user?.isNtfy;
        const wilaya = shipping?.wilaya.name
        const commune = communes?.name

        if (isNtfy && topic) {
            const message = `new order: ${dto.platform || "mdstore"}
-------------------------
👤 customer: ${dto.customerName}
📍 wilaya: ${wilaya}
🏙️ commune: ${commune}
📞 phone: ${dto.customerPhone}
🛍️ product: ${this.formatName(productName)}
🚚 type ship: ${dto.typeShip || dto.typeLivraison || TypeShipEnum.HOME}
💰 price: ${dto.totalPrice} + ${dto.priceShip || dto.priceLivraison || 0}`.trim();

            // إرسال الرسالة المنسقة
            this.ntfyService.publish(topic, message);
        }

        return savedOrder;
    }


    async getAllOrdersByStoreId(storeId: string, status?: StatusEnum, query?: string, page: number = 1) {
        // 1. بناء الشرط الأساسي الذي يجب أن يتوفر في كل الحالات
        const baseWhere: any = { storeId: storeId };
        const limit = 50;
        const skip = (page - 1) * limit;

        // 2. إضافة الحالة (status) إذا وجدت
        if (status) {
            baseWhere.status = status;
        }

        // 3. التعامل مع البحث (query)
        let whereCondition: any | any[];

        if (query) {
            const search = `%${query}%`; // للبحث الجزئي
            whereCondition = [
                { ...baseWhere, customerName: ILike(search) },  // ILike تتجاهل حالة الأحرف
                { ...baseWhere, customerPhone: Like(search) }
            ];
        } else {
            whereCondition = baseWhere;
        }

        return this.ordersrepo.find({
            where: whereCondition,
            relations: [
                'product',
                'product.imagesProduct',
                'customerWilaya',
                'customerCommune',
                'variantDetail',
                'offer'
            ],
            order: {
                createdAt: 'DESC'
            },
            take: limit,
            skip: skip
        });
    }

    async getCountPageByStoreId(storeId, status?: StatusEnum, query?: string,) {
        // 1. بناء الشرط الأساسي الذي يجب أن يتوفر في كل الحالات
        const baseWhere: any = { storeId: storeId };

        // 2. إضافة الحالة (status) إذا وجدت
        if (status) {
            baseWhere.status = status;
        }

        // 3. التعامل مع البحث (query)
        let whereCondition: any | any[];

        if (query) {
            const search = `%${query}%`; // للبحث الجزئي
            whereCondition = [
                { ...baseWhere, customerName: ILike(search) },  // ILike تتجاهل حالة الأحرف
                { ...baseWhere, customerPhone: Like(search) }
            ];
        } else {
            whereCondition = baseWhere;
        }
        return this.ordersrepo.count({
            where: whereCondition,
        })
    }

    async getOne(orderId: string) {
        return this.ordersrepo.findOne({ where: { id: orderId }, relations: ['product', 'store.user'] },)
    }

    async updateInfoUser(orderId: string, dto: UpdateOrderDto) {
        const order = await this.ordersrepo.findOne({ where: { id: orderId } });

        if (!order) {
            throw new NotFoundException('order not exist');
        }

        await this.ordersrepo.update(orderId, {
            customerCommuneId: dto.customerCommuneId ?? order.customerCommuneId,
            customerName: dto.customerName ?? order.customerName,
            customerPhone: dto.customerPhone ?? order.customerPhone,
            customerWilayaId: dto.customerWilayaId ?? order.customerWilayaId,
            offerId: dto.offerId ?? order.offerId,
            priceShip: dto.priceShip ?? order.priceShip,
            quantity: dto.quantity ?? order.quantity,
            // معالجة الـ Enum للحالة بشكل صحيح
            status: (dto.status ?? order.status) as StatusEnum,
            totalPrice: dto.totalPrice ?? order.totalPrice,
            typeShip: dto.typeShip ?? order.typeShip,
            unityPrice: dto.unityPrice ?? order.unityPrice,
            variantDetailId: dto.variantDetailId ?? order.variantDetailId,
        });

        return this.ordersrepo.findOne({
            where: { id: orderId },
            relations: [
                'product',
                'product.imagesProduct',
                'variantDetail',
                'offer',
                'customerWilaya',
                'customerCommune',
            ],
        });
    }

    async getCountStatus(storeId: string) {
        const counts = await this.ordersrepo
            .createQueryBuilder('order')
            .select('order.status', 'status') // نختار عمود الحالة
            .addSelect('COUNT(order.id)', 'count') // نحسب عدد الطلبات
            .where('order.storeId = :storeId', { storeId }) // نفلتر حسب المتجر
            .groupBy('order.status') // نجمع النتائج بناءً على الحالة
            .getRawMany(); // نستخدم RawMany لأننا نستخدم دالة COUNT (ليست Entity كاملة)

        return counts;
    }

    async delete(id: string) {
        const order: any = await this.ordersrepo.findOne({ where: { id } })
        return this.ordersrepo.remove(order)
    }
}