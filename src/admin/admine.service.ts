import {
    Injectable,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';

import { User, UserRole } from '../user/entities/user.entity';
import { Store } from '../store/entities/store.entity';
import { Product } from '../product/entities/product.entity';
import { Order } from '../order/entities/order.entity';
import { StatusEnum } from '../order/entities/order.entity';
import { Theme } from '../theme/entities/theme.entity';
import { ThemeType } from '../theme/entities/theme-type.entity';
import { ThemeUser } from '../theme/entities/theme-user.entity';
import { Niche } from '../niche/entities/niche.entity';
import { Category } from '../category/entities/category.entity';
import { LandingPage } from '../landing-page/entities/landing-page.entity';
import { Image } from '../image/entities/image.entity';
import type { CreateThemeDto, UpdateThemeDto } from './admin.controller';
import { Wilaya } from '../shipping/entity/wilaya.entity';
import { MessageAdmine } from './entity/message-admin.entity';
import { CreateMessageAdminDto } from './dto/message-admine.dto';

// ─────────────────────────────────────────────────────────────────────────────
// Local shape types — used only as plain type annotations inside the service,
// never in a decorated signature, so interfaces are safe here.
// The controller re-declares these as classes for emitDecoratorMetadata.
// ─────────────────────────────────────────────────────────────────────────────

export interface PaginationQuery {
    page?: number;
    limit?: number;
}

export interface DateRangeQuery {
    from?: string;
    to?: string;
}

export interface DashboardStats {
    users: {
        total: number;
        verified: number;
        admins: number;
        newThisMonth: number;
    };
    stores: {
        total: number;
        active: number;
        inactive: number;
    };
    orders: {
        total: number;
        byStatus: Record<StatusEnum, number>;
        totalRevenue: number;
        revenueThisMonth: number;
    };
    products: {
        total: number;
        active: number;
        outOfStock: number;
    };
    themes: {
        total: number;
        active: number;
        totalPurchases: number;
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class AdminService {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,

        @InjectRepository(Store)
        private readonly storeRepo: Repository<Store>,

        @InjectRepository(Product)
        private readonly productRepo: Repository<Product>,

        @InjectRepository(Order)
        private readonly orderRepo: Repository<Order>,

        @InjectRepository(Theme)
        private readonly themeRepo: Repository<Theme>,

        @InjectRepository(ThemeType)
        private readonly themeTypeRepo: Repository<ThemeType>,

        @InjectRepository(ThemeUser)
        private readonly themeUserRepo: Repository<ThemeUser>,

        @InjectRepository(Niche)
        private readonly nicheRepo: Repository<Niche>,

        @InjectRepository(Category)
        private readonly categoryRepo: Repository<Category>,

        @InjectRepository(LandingPage)
        private readonly landingPageRepo: Repository<LandingPage>,

        @InjectRepository(Image)
        private readonly imageRepo: Repository<Image>,

        @InjectRepository(Wilaya)
        private readonly wilayaRepo: Repository<Wilaya>,

        @InjectRepository(MessageAdmine)
        private readonly messageAdmineRepo: Repository<MessageAdmine>,
    ) { }

    // ═══════════════════════════════════════════════════════════════════════════
    // 1. DASHBOARD
    // ═══════════════════════════════════════════════════════════════════════════

    async getDashboardStats(): Promise<DashboardStats> {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // 1. إحصائيات المستخدمين (Users)
        const [totalUsers, verifiedUsers, admins, newUsers] = await Promise.all([
            this.userRepo.count(),
            this.userRepo.count({ where: { isVerified: true } }), // تأكد من وجود حقل isVerified
            this.userRepo.count({ where: { role: UserRole.ADMIN } }),
            this.userRepo.count({ where: { createdAt: Between(startOfMonth, now) } })
        ]);

        // 2. إحصائيات المتاجر (Stores)
        const [totalStores, activeStores] = await Promise.all([
            this.storeRepo.count(),
            this.storeRepo.count({ where: { isActive: true } })
        ]);

        // 3. إحصائيات الطلبات (Orders)
        // نستخدم totalCartPrice للحسابات المالية
        const allOrders = await this.orderRepo.find({
            select: ['status', 'totalPrice', 'createdAt']
        });

        const byStatus = Object.values(StatusEnum).reduce(
            (acc, s) => ({ ...acc, [s]: 0 }),
            {} as Record<StatusEnum, number>,
        );

        let totalRevenue = 0;
        let revenueThisMonth = 0;

        allOrders.forEach((o) => {
            // حساب الحالات
            byStatus[o.status]++;

            // حساب الأرباح
            const price = Number(o.totalPrice) || 0;
            totalRevenue += price;
            if (o.createdAt >= startOfMonth) {
                revenueThisMonth += price;
            }
        });

        // 4. إحصائيات المنتجات (Products)
        const [totalProducts, activeProducts, outOfStock] = await Promise.all([
            this.productRepo.count(),
            this.productRepo.count({ where: { isActive: true } }),
            this.productRepo.count({ where: { stock: 0 } }) // تأكد من وجود حقل stock
        ]);

        // 5. إحصائيات القوالب (Themes)
        const [totalThemes, activeThemes, totalPurchases] = await Promise.all([
            this.themeRepo.count(),
            this.themeRepo.count({ where: { isActive: true } }),
            this.themeUserRepo.count() // جدول المشتريات ThemeUser
        ]);

        return {
            users: {
                total: totalUsers,
                verified: verifiedUsers,
                admins: admins,
                newThisMonth: newUsers,
            },
            stores: {
                total: totalStores,
                active: activeStores,
                inactive: totalStores - activeStores,
            },
            orders: {
                total: allOrders.length,
                byStatus: byStatus,
                totalRevenue: Number(totalRevenue.toFixed(2)),
                revenueThisMonth: Number(revenueThisMonth.toFixed(2)),
            },
            products: {
                total: totalProducts,
                active: activeProducts,
                outOfStock: outOfStock,
            },
            themes: {
                total: totalThemes,
                active: activeThemes,
                totalPurchases: totalPurchases,
            },
        };
    }

    // Revenue chart data grouped by day for a given date range
    async getRevenueChart(query: DateRangeQuery) {
        const from = query.from ? new Date(query.from) : new Date(Date.now() - 30 * 86400000);
        const to = query.to ? new Date(query.to) : new Date();

        const orders = await this.orderRepo.find({
            where: { createdAt: Between(from, to) },
            select: ['totalPrice', 'createdAt'], // تعديل الحقل هنا
        });

        const grouped: Record<string, number> = {};
        orders.forEach((o) => {
            const day = o.createdAt.toISOString().split('T')[0];
            grouped[day] = (grouped[day] ?? 0) + Number(o.totalPrice);
        });

        return Object.entries(grouped)
            .map(([date, revenue]) => ({ date, revenue: +revenue.toFixed(2) }))
            .sort((a, b) => a.date.localeCompare(b.date));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 2. USER MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    async getAllUsers({ page = 1, limit = 20 }: PaginationQuery) {
        const [users, total] = await this.userRepo.findAndCount({
            select: ['id', 'username', 'email', 'phone', 'role', 'isVerified', 'provider', 'createdAt'],
            relations: ['stores'],
            order: { createdAt: 'DESC' },
            skip: (page - 1) * limit,
            take: limit,
        });

        return { data: users, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async getUserById(id: string) {
        const user = await this.userRepo.findOne({
            where: { id },
            relations: ['stores', 'stores.orders', 'images'],
        });
        if (!user) throw new NotFoundException(`User #${id} not found`);
        return user;
    }

    async updateUserRole(id: string, role: UserRole) {
        const user = await this.getUserById(id);
        user.role = role;
        return this.userRepo.save(user);
    }

    async toggleUserVerification(id: string) {
        const user = await this.getUserById(id);
        user.isVerified = !user.isVerified;
        return this.userRepo.save(user);
    }

    async deleteUser(id: string) {
        const user = await this.getUserById(id);
        await this.userRepo.remove(user);
        return { message: `User #${id} deleted successfully` };
    }

    async searchUsers(query: string, pagination: PaginationQuery) {
        const { page = 1, limit = 20 } = pagination;

        const [users, total] = await this.userRepo
            .createQueryBuilder('user')
            .where('user.username ILIKE :q OR user.email ILIKE :q', { q: `%${query}%` })
            .select([
                'user.id', 'user.username', 'user.email',
                'user.role', 'user.isVerified', 'user.createdAt',
            ])
            .orderBy('user.createdAt', 'DESC')
            .skip((page - 1) * limit)
            .take(limit)
            .getManyAndCount();

        return { data: users, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 3. STORE MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    async getAllStores({ page = 1, limit = 20 }: PaginationQuery) {
        const [stores, total] = await this.storeRepo.findAndCount({
            relations: ['user', 'niche', 'design'],
            order: { createdAt: 'DESC' },
            skip: (page - 1) * limit,
            take: limit,
        });

        return { data: stores, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async getStoreById(id: string) {
        const store = await this.storeRepo.findOne({
            where: { id },
            relations: [
                'user', 'niche', 'design', 'topBar', 'contact',
                'hero', 'pixels', 'themeUser', 'themeUser.theme',
            ],
        });
        if (!store) throw new NotFoundException(`Store #${id} not found`);
        return store;
    }

    async getStoreStats(id: string) {
        await this.getStoreById(id); // ensure exists

        const [totalProducts, totalOrders, orders] = await Promise.all([
            this.productRepo.count({ where: { store: { id } } }),
            this.orderRepo.count({ where: { storeId: id } }),
            this.orderRepo.find({
                where: { storeId: id },
                select: ['totalPrice', 'status'],
            }),
        ]);

        const totalRevenue = orders.reduce((sum, o) => sum + Number(o.totalPrice), 0);
        const byStatus = Object.values(StatusEnum).reduce(
            (acc, s) => ({ ...acc, [s]: 0 }),
            {} as Record<StatusEnum, number>,
        );
        orders.forEach((o) => byStatus[o.status]++);

        return { totalProducts, totalOrders, totalRevenue: +totalRevenue.toFixed(2), byStatus };
    }

    async toggleStoreStatus(id: string) {
        const store = await this.getStoreById(id);
        store.isActive = !store.isActive;
        return this.storeRepo.save(store);
    }

    async deleteStore(id: string) {
        const store = await this.getStoreById(id);
        await this.storeRepo.remove(store);
        return { message: `Store #${id} deleted successfully` };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 4. ORDER MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    async getAllOrders({ page = 1, limit = 20 }: PaginationQuery) {
        const [orders, total] = await this.orderRepo.findAndCount({
            relations: ['product', 'store', 'customerWilaya', 'customerCommune'],
            order: { createdAt: 'DESC' },
            skip: (page - 1) * limit,
            take: limit,
        });

        return { data: orders, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async getOrdersByStatus(status: StatusEnum, pagination: PaginationQuery) {
        const { page = 1, limit = 20 } = pagination;

        const [orders, total] = await this.orderRepo.findAndCount({
            where: { status },
            relations: ['product', 'store', 'customerWilaya', 'customerCommune'],
            order: { createdAt: 'DESC' },
            skip: (page - 1) * limit,
            take: limit,
        });

        return { data: orders, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async getOrderById(id: string) {
        const order = await this.orderRepo.findOne({
            where: { id },
            relations: [
                'product', 'store', 'variantDetail',
                'offer', 'customerWilaya', 'customerCommune',
            ],
        });
        if (!order) throw new NotFoundException(`Order #${id} not found`);
        return order;
    }

    async updateOrderStatus(id: string, status: StatusEnum) {
        const order = await this.getOrderById(id);
        const now = new Date();

        order.status = status;
        if (status === StatusEnum.CONFIRMED) order.confirmedAt = now;
        if (status === StatusEnum.SHIPPING) order.shippingAt = now;
        if (status === StatusEnum.DELIVERED) order.deliveredAt = now;

        return this.orderRepo.save(order);
    }

    async getOrdersInDateRange(query: DateRangeQuery, pagination: PaginationQuery) {
        const { page = 1, limit = 20 } = pagination;
        const from = query.from ? new Date(query.from) : new Date(0);
        const to = query.to ? new Date(query.to) : new Date();

        const [orders, total] = await this.orderRepo.findAndCount({
            where: { createdAt: Between(from, to) },
            relations: ['product', 'store'],
            order: { createdAt: 'DESC' },
            skip: (page - 1) * limit,
            take: limit,
        });

        return { data: orders, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 5. PRODUCT MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    async getAllProducts({ page = 1, limit = 20 }: PaginationQuery) {
        const [products, total] = await this.productRepo.findAndCount({
            relations: ['store', 'category'],
            order: { createdAt: 'DESC' },
            skip: (page - 1) * limit,
            take: limit,
        });

        return { data: products, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async getProductById(id: string) {
        const product = await this.productRepo.findOne({
            where: { id },
            relations: [
                'store', 'category', 'attributes', 'attributes.variants',
                'variantDetails', 'offers', 'imagesProduct',
            ],
        });
        if (!product) throw new NotFoundException(`Product #${id} not found`);
        return product;
    }

    async toggleProductStatus(id: string) {
        const product = await this.getProductById(id);
        product.isActive = !product.isActive;
        return this.productRepo.save(product);
    }

    async deleteProduct(id: string) {
        const product = await this.getProductById(id);
        await this.productRepo.softRemove(product);
        return { message: `Product #${id} soft-deleted successfully` };
    }

    async hardDeleteProduct(id: string) {
        const product = await this.productRepo.findOne({ where: { id }, withDeleted: true });
        if (!product) throw new NotFoundException(`Product #${id} not found`);
        await this.productRepo.remove(product);
        return { message: `Product #${id} permanently deleted` };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 6. THEME MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    async getAllThemes({ page = 1, limit = 20 }: PaginationQuery) {
        const [themes, total] = await this.themeRepo.findAndCount({
            relations: ['types'],
            order: { price: 'ASC' },
            skip: (page - 1) * limit,
            take: limit,
        });

        return { data: themes, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async getThemeById(id: string) {
        const theme = await this.themeRepo.findOne({
            where: { id },
            relations: ['types', 'themeUsers'],
        });
        if (!theme) throw new NotFoundException(`Theme #${id} not found`);
        return theme;
    }

    async createTheme(dto: CreateThemeDto) {
        if (dto.typeId) {
            const type = await this.themeTypeRepo.findOne({ where: { id: dto.typeId } });
            if (!type) throw new NotFoundException(`ThemeType #${dto.typeId} not found`);
        }
        const theme = this.themeRepo.create(dto);
        return this.themeRepo.save(theme);
    }

    async updateTheme(id: string, dto: UpdateThemeDto) {
        const theme = await this.getThemeById(id);
        Object.assign(theme, dto);
        return this.themeRepo.save(theme);
    }

    async toggleThemeStatus(id: string) {
        const theme = await this.getThemeById(id);
        theme.isActive = !theme.isActive;
        return this.themeRepo.save(theme);
    }

    async deleteTheme(id: string) {
        const theme = await this.getThemeById(id);
        await this.themeRepo.remove(theme);
        return { message: `Theme #${id} deleted successfully` };
    }

    async getThemePurchases(themeId: string, pagination: PaginationQuery) {
        const { page = 1, limit = 20 } = pagination;

        const [purchases, total] = await this.themeUserRepo.findAndCount({
            where: { themeId },
            relations: ['theme', 'stores'],
            skip: (page - 1) * limit,
            take: limit,
        });

        return { data: purchases, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 7. THEME TYPE MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    async getAllThemeTypes() {
        return this.themeTypeRepo.find({ relations: ['theme'] });
    }

    async createThemeType(name: string) {
        const existing = await this.themeTypeRepo.findOne({ where: { name } });
        if (existing) throw new BadRequestException(`ThemeType "${name}" already exists`);
        const type = this.themeTypeRepo.create({ name });
        return this.themeTypeRepo.save(type);
    }

    async updateThemeType(id: string, name: string) {
        const type = await this.themeTypeRepo.findOne({ where: { id } });
        if (!type) throw new NotFoundException(`ThemeType #${id} not found`);
        type.name = name;
        return this.themeTypeRepo.save(type);
    }

    async deleteThemeType(id: string) {
        const type = await this.themeTypeRepo.findOne({ where: { id } });
        if (!type) throw new NotFoundException(`ThemeType #${id} not found`);
        await this.themeTypeRepo.remove(type);
        return { message: `ThemeType #${id} deleted successfully` };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 8. NICHE MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    async getAllNiches() {
        return this.nicheRepo.find({ relations: ['stores'] });
    }

    async getNicheById(id: string) {
        const niche = await this.nicheRepo.findOne({ where: { id }, relations: ['stores'] });
        if (!niche) throw new NotFoundException(`Niche #${id} not found`);
        return niche;
    }

    async createNiche(dto: { name: string; icon: string }) {
        const niche = this.nicheRepo.create(dto);
        return this.nicheRepo.save(niche);
    }

    async updateNiche(id: string, dto: Partial<{ name: string; icon: string }>) {
        const niche = await this.getNicheById(id);
        Object.assign(niche, dto);
        return this.nicheRepo.save(niche);
    }

    async deleteNiche(id: string) {
        const niche = await this.getNicheById(id);
        await this.nicheRepo.remove(niche);
        return { message: `Niche #${id} deleted successfully` };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 9. LANDING PAGE MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    async getAllLandingPages({ page = 1, limit = 20 }: PaginationQuery) {
        const [pages, total] = await this.landingPageRepo.findAndCount({
            relations: ['product', 'product.store'],
            order: { id: 'DESC' },
            skip: (page - 1) * limit,
            take: limit,
        });

        return { data: pages, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async deleteLandingPage(id: string) {
        const lp = await this.landingPageRepo.findOne({ where: { id } });
        if (!lp) throw new NotFoundException(`LandingPage #${id} not found`);
        await this.landingPageRepo.remove(lp);
        return { message: `LandingPage #${id} deleted successfully` };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 10. IMAGE MANAGEMENT
    // ═══════════════════════════════════════════════════════════════════════════

    async getAllImages({ page = 1, limit = 20 }: PaginationQuery) {
        const [images, total] = await this.imageRepo.findAndCount({
            relations: ['user'],
            order: { createdAt: 'DESC' },
            skip: (page - 1) * limit,
            take: limit,
        });

        return { data: images, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async getImagesByUser(userId: string, pagination: PaginationQuery) {
        const { page = 1, limit = 20 } = pagination;

        const [images, total] = await this.imageRepo.findAndCount({
            where: { user: { id: userId } },
            order: { createdAt: 'DESC' },
            skip: (page - 1) * limit,
            take: limit,
        });

        return { data: images, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async deleteImage(id: string) {
        const image = await this.imageRepo.findOne({ where: { id } });
        if (!image) throw new NotFoundException(`Image #${id} not found`);
        await this.imageRepo.remove(image);
        return { message: `Image #${id} deleted. S3 key: "${image.key}" — remove from S3 separately.` };
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 11. SHIPPING / WILAYA INFO
    // ═══════════════════════════════════════════════════════════════════════════

    async getAllWilayas() {
        return this.wilayaRepo.find({ relations: ['communes'], order: { id: 'ASC' } });
    }

    async getWilayaOrderStats() {
        const result = await this.orderRepo
            .createQueryBuilder('order')
            .select('wilaya.ar_name', 'wilaya')
            .addSelect('COUNT(order.id)', 'total')
            .addSelect('SUM(order.totalPrice)', 'revenue')
            .innerJoin('order.customerWilaya', 'wilaya')
            .groupBy('wilaya.ar_name')
            .orderBy('total', 'DESC')
            .getRawMany();

        return result.map((r) => ({
            wilaya: r.wilaya,
            total: +r.total,
            revenue: +(+r.revenue).toFixed(2),
        }));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 12. ANALYTICS
    // ═══════════════════════════════════════════════════════════════════════════

    /** الأرقام الأكثر إرجاعاً — top 10 phone numbers with most returned orders */
    async getTopReturnedPhones(limit = 10) {
        const result = await this.orderRepo
            .createQueryBuilder('order')
            .select('order.customerPhone', 'phone')
            .addSelect('order.customerName', 'name')
            .addSelect('COUNT(order.id)', 'total') // الاسم المستعار هنا "total"
            .where("order.status = 'returned'")
            .groupBy('order.customerPhone')
            .addGroupBy('order.customerName')
            // الحل: نستخدم COUNT(order.id) مباشرة في الترتيب لتجنب مشاكل الأسماء المستعارة في Postgres
            .orderBy('COUNT(order.id)', 'DESC')
            .limit(limit)
            .getRawMany();

        return result.map((r) => ({
            phone: r.phone,
            name: r.name,
            total: +r.total,
        }));
    }

    /** الولايات الأكثر طلباً — top 10 wilayas by confirmed/delivered orders (no returns) */
    async getTopWilayasWithoutReturns(limit = 10) {
        const result = await this.orderRepo
            .createQueryBuilder('order')
            .select('wilaya.ar_name', 'wilaya')
            .addSelect('COUNT(order.id)', 'total')
            .addSelect('SUM(order.totalPrice)', 'revenue')
            .innerJoin('order.customerWilaya', 'wilaya')
            .where("order.status NOT IN ('returned', 'cancelled')")
            .groupBy('wilaya.ar_name')
            // التعديل هنا: نستخدم الدالة COUNT مباشرة لضمان التوافق مع Postgres
            .orderBy('COUNT(order.id)', 'DESC')
            .limit(limit)
            .getRawMany();

        return result.map((r) => ({
            wilaya: r.wilaya,
            total: +r.total,
            revenue: +(+r.revenue).toFixed(2),
        }));
    }

    /** الولايات الأكثر إرجاعاً — top 10 wilayas by returned orders */
    async getTopReturnedWilayas(limit = 10) {
        const result = await this.orderRepo
            .createQueryBuilder('order')
            .select('wilaya.ar_name', 'wilaya')
            .addSelect('COUNT(order.id)', 'total')
            .innerJoin('order.customerWilaya', 'wilaya')
            .where("order.status = 'returned'")
            .groupBy('wilaya.ar_name')
            // التعديل: استخدم الدالة الحسابية مباشرة بدلاً من كلمة total
            .orderBy('COUNT(order.id)', 'DESC')
            .limit(limit)
            .getRawMany();

        return result.map((r) => ({
            wilaya: r.wilaya,
            total: +r.total,
        }));
    }

    /** المنتجات الأكثر طلباً — top 10 most ordered products */
    async getTopProducts(limit = 10) {
        const result = await this.orderRepo
            .createQueryBuilder('order')
            .innerJoin('order.items', 'item') // الربط مع العناصر أولاً
            .innerJoin('item.product', 'product')
            .select('product.id', 'productId')
            .addSelect('product.name', 'name')
            .addSelect('product.productImage', 'image')
            .addSelect('COUNT(DISTINCT order.id)', 'totalOrders')
            .addSelect('SUM(item.quantity)', 'totalQty') // الكمية من Item
            .addSelect('SUM(item.totalPrice)', 'revenue') // السعر من Item
            .groupBy('product.id')
            .addGroupBy('product.name')
            .addGroupBy('product.productImage')
            .orderBy('SUM(item.quantity)', 'DESC')
            .limit(limit)
            .getRawMany();

        return result.map((r) => ({
            productId: r.productId,
            name: r.name,
            image: r.image,
            totalOrders: +r.totalOrders,
            totalQty: +r.totalQty,
            revenue: +(+r.revenue).toFixed(2),
        }));
    }

    /** الأصناف الأكثر طلباً — top categories by order count */
    async getTopCategories(limit = 10) {
        const result = await this.orderRepo
            .createQueryBuilder('order')
            .select('category.id', 'categoryId')
            .addSelect('category.name', 'name')
            .addSelect('COUNT(order.id)', 'totalOrders')
            .addSelect('SUM(order.totalPrice)', 'revenue')
            .innerJoin('order.product', 'product')
            .innerJoin('product.category', 'category')
            .groupBy('category.id')
            .addGroupBy('category.name')
            // التعديل الضروري هنا:
            .orderBy('COUNT(order.id)', 'DESC')
            .limit(limit)
            .getRawMany();

        return result.map((r) => ({
            categoryId: r.categoryId,
            name: r.name,
            totalOrders: +r.totalOrders,
            revenue: +(+r.revenue).toFixed(2),
        }));
    }

    /** المتاجر الأكثر طلباً — top stores by order count */
    async getTopStores(limit = 10) {
        const result = await this.orderRepo
            .createQueryBuilder('order')
            .select('store.id', 'storeId')
            .addSelect('store.name', 'name')
            .addSelect('store.subdomain', 'subdomain')
            .addSelect('COUNT(order.id)', 'totalOrders')
            .addSelect('SUM(order.totalPrice)', 'revenue')
            .innerJoin('order.store', 'store')
            .groupBy('store.id')
            .addGroupBy('store.name')
            .addGroupBy('store.subdomain')
            // التعديل: الترتيب باستخدام الدالة الحسابية مباشرة لضمان توافق Postgres
            .orderBy('COUNT(order.id)', 'DESC')
            .limit(limit)
            .getRawMany();

        return result.map((r) => ({
            storeId: r.storeId,
            name: r.name,
            subdomain: r.subdomain,
            totalOrders: +r.totalOrders,
            revenue: +(+r.revenue).toFixed(2),
        }));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 11. contact
    // ═══════════════════════════════════════════════════════════════════════════

    async createMessage(dto: CreateMessageAdminDto) {
        const createMessage = await this.messageAdmineRepo.create(dto)
        await this.messageAdmineRepo.save(createMessage)

        return { success: true }
    }

    // 1. دالة جلب الإحصائيات (Count)
    async getCountMessage(search?: string, tab: string = 'all') {
        // 1. الإحصائيات العامة (ثابتة لا تتأثر بالفلترة عادةً لتظهر في المربعات العلوية)
        const totalCount = await this.messageAdmineRepo.count();
        const unreadCount = await this.messageAdmineRepo.count({ where: { isReplied: false, isArchived: false } });
        const archivedCount = await this.messageAdmineRepo.count({ where: { isArchived: true } });

        // 2. حساب عدد النتائج "المفلترة" (التي تظهر للمستخدم حالياً بناءً على البحث والتبويب)
        const query = this.messageAdmineRepo.createQueryBuilder('message');

        // تطبيق فلترة التبويب (Tab)
        if (tab === 'archive') {
            query.andWhere('message.isArchived = :isArchived', { isArchived: true });
        } else if (tab === 'reading') {
            query.andWhere('message.isReplied = :isReplied', { isReplied: true })
                .andWhere('message.isArchived = :isArchived', { isArchived: false });
        } else {
            query.andWhere('message.isArchived = :isArchived', { isArchived: false });
        }

        // تطبيق فلترة البحث (Search)
        if (search) {
            query.andWhere(
                '(message.username LIKE :search OR message.subject LIKE :search OR message.email LIKE :search)',
                { search: `%${search}%` }
            );
        }

        const filteredCount = await query.getCount();

        return {
            stats: {
                total: totalCount,
                unread: unreadCount,
                archived: archivedCount
            },
            filteredCount // هذا الرقم الذي ستستخدمه في جملة "You have X messages"
        };
    }

    async getAllMessage(page: number = 1, search?: string, tab: string = 'new') {
        // التأكد من أن رقم الصفحة دائماً رقم صحيح أكبر من 0
        const currentPage = Math.max(1, Number(page) || 1);
        const limit = 10;
        const skip = (currentPage - 1) * limit;

        const query = this.messageAdmineRepo.createQueryBuilder('message');

        // 1. منطق التبويبات (Tabs Logic)
        if (tab === 'archive') {
            query.andWhere('message.isArchived = :isArchived', { isArchived: true });
        } else if (tab === 'reading') {
            query.andWhere('message.isReplied = :isReplied', { isReplied: true })
                .andWhere('message.isArchived = :isArchived', { isArchived: false });
        } else {
            // إذا كان التبويب 'new' أو أي شيء آخر، اعرض الرسائل غير المؤرشفة وغير المقروءة (أو حسب رغبتك)
            // الخيار الأفضل لـ 'new':
            query.andWhere('message.isArchived = :isArchived', { isArchived: false })
                .andWhere('message.isReplied = :isReplied', { isReplied: false });
        }

        // 2. منطق البحث (Search Logic)
        if (search && search.trim() !== "") {
            query.andWhere(
                '(message.username ILIKE :search OR message.subject ILIKE :search OR message.email ILIKE :search)',
                { search: `%${search}%` }
            );
        }

        // 3. الترتيب والتقسيم
        query.orderBy('message.createdAt', 'DESC')
            .take(limit)
            .skip(skip);

        try {
            const [messages, total] = await query.getManyAndCount();

            return {
                data: messages,
                meta: {
                    totalItems: total,
                    totalPages: Math.ceil(total / limit),
                    currentPage: currentPage,
                    itemsPerPage: limit,
                },
            };
        } catch (error) {
            console.error("Database Error:", error);
            throw new Error("Failed to fetch messages from database");
        }
    }

    async updateStatus(id: string, status: 'replied' | 'archived') {
        const updateData: Partial<MessageAdmine> = {};

        if (status === 'replied') {
            updateData.isReplied = true;
        } else if (status === 'archived') {
            updateData.isArchived = true;
        }

        const result = await this.messageAdmineRepo.update(id, updateData);

        if (result.affected === 0) {
            throw new Error("Message not found");
        }

        return { message: `Status updated to ${status} successfully` };
    }

}