import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, TreeRepository } from 'typeorm';
import { Store } from './entities/store.entity';
import { StorePixel } from './entities/store-pixel.entity';
import { StoreDesign } from './entities/store-design.entity';
import { StoreTopBar } from './entities/store-topBar.entity';
import { StoreContact } from './entities/store-contact.entity';
import { StoreHeroSection } from './entities/hero-section.entity';
import { UpdateFullStoreDto } from './dto/update-store.dto';
import { CreateFullStoreDto } from './dto/create-full-store.dto';
import { CreatePixelDto } from './dto/pixel/create-pixel.dto';
import { UpdatePixelDto } from './dto/pixel/update-pixel.dto';
import { Category } from '../category/entities/category.entity';
import { SubscriptionService } from '../subscription/subscription.service';
import { Show } from '../show/entity/show.entity';
import { Product } from '../product/entities/product.entity';
import { Domain } from '../domain/entities/domain.entity';
import { CategoryNiche } from '../niche/entities/category-niche.entity';
import { ImageProduct } from '../image-product/entities/image-product.entity';

@Injectable()
export class StoreService {
    // ─── In-memory cache للمتاجر ─────────────────────────────────────────────
    private readonly storesCache = new Map<string, { data: Store[]; ts: number }>();
    private readonly CACHE_TTL = 30_000; // 30 ثانية

    private getCachedStores(userId: string): Store[] | null {
        const hit = this.storesCache.get(userId);
        if (hit && Date.now() - hit.ts < this.CACHE_TTL) return hit.data;
        return null;
    }

    invalidateStoresCache(userId: string) {
        this.storesCache.delete(userId);
    }

    constructor(
        private readonly dataSource: DataSource,
        @InjectRepository(Store) private readonly storeRepository: Repository<Store>,
        @InjectRepository(StorePixel) private readonly pixelRepository: Repository<StorePixel>,
        @InjectRepository(Category) private categoryRepository: TreeRepository<Category>,
        @InjectRepository(CategoryNiche) private cateNicheRepo: Repository<CategoryNiche>,
        @InjectRepository(Product) private productRepo: Repository<Product>,
        @InjectRepository(ImageProduct) private imageProductRepository: Repository<ImageProduct>,


        private readonly subscriptionService: SubscriptionService,
    ) { }

    // ─── helpers ─────────────────────────────────────────────────────────────
    private async getStoreLimit(userId: string): Promise<number> {
        const sub = await this.subscriptionService.findSub(userId);
        return sub?.plan?.features?.storeNumber ?? 1;
    }

    private async assertStoreLimitNotReached(userId: string): Promise<void> {
        const [limit, count] = await Promise.all([
            this.getStoreLimit(userId),
            this.storeRepository.count({ where: { user: { id: userId }, isActive: true } }),
        ]);
        if (count >= limit) {
            throw new BadRequestException(`لقد وصلت إلى الحد الأقصى للمتاجر النشطة في خطتك (${limit} متاجر).`);
        }
    }

    private async getPixelLimit(userId: string, type: 'facebook' | 'tiktok'): Promise<number> {
        const sub = await this.subscriptionService.findSub(userId);
        return type === 'facebook'
            ? (sub?.plan?.features?.pixelFacebookNumber ?? 0)
            : (sub?.plan?.features?.pixelTiktokNumber ?? 0);
    }

    private async assertPixelLimitNotReached(userId: string, type: 'facebook' | 'tiktok', extraMessage?: string): Promise<void> {
        const [limit, count] = await Promise.all([
            this.getPixelLimit(userId, type),
            this.pixelRepository.count({ where: { type, store: { user: { id: userId } }, isActive: true } }),
        ]);
        if (count >= limit) {
            throw new BadRequestException(extraMessage ?? `لقد وصلت إلى الحد الأقصى لبكسلات ${type} في خطتك الحالية (${limit}).`);
        }
    }

    // ==================== PIXELS ====================

    async addPixel(storeId: string, dto: CreatePixelDto, userId: string) {
        const store = await this.storeRepository.findOne({ where: { id: storeId, user: { id: userId } } });
        if (!store) throw new NotFoundException('Store not found or you do not have permission');

        await this.assertPixelLimitNotReached(userId, dto.type as 'facebook' | 'tiktok');

        const duplicatePixelId = await this.pixelRepository.findOne({
            where: { storeId, pixelId: dto.pixelId, type: dto.type, isActive: true },
        });
        if (duplicatePixelId) throw new BadRequestException(`هذا البكسل (ID: ${dto.pixelId}) مضاف بالفعل لهذا المتجر.`);

        const pixel = this.pixelRepository.create({ ...dto, storeId });
        const result = await this.pixelRepository.save(pixel);
        this.invalidateStoresCache(userId);
        return result;
    }

    async updatePixel(pixelId: string, dto: UpdatePixelDto, userId: string) {
        const pixel = await this.pixelRepository.findOne({ where: { id: pixelId }, relations: ['store', 'store.user'] });
        if (!pixel || pixel.store.user.id !== userId) throw new NotFoundException('Pixel not found or you do not have permission');
        Object.assign(pixel, dto);
        return this.pixelRepository.save(pixel);
    }

    async deletePixel(pixelId: string, userId: string) {
        const pixel = await this.pixelRepository.findOne({ where: { id: pixelId }, relations: ['store', 'store.user'] });
        if (!pixel || pixel.store.user.id !== userId) throw new NotFoundException('Pixel not found or you do not have permission');
        await this.pixelRepository.remove(pixel);
        return { success: true, message: 'Pixel deleted successfully' };
    }

    async getStorePixels(storeId: string, userId: string) {
        const store = await this.storeRepository.findOne({ where: { id: storeId, user: { id: userId } } });
        if (!store) throw new NotFoundException('Store not found or you do not have permission');
        return this.pixelRepository.find({ where: { storeId }, order: { createdAt: 'DESC' } });
    }

    async getActivePixels(storeId: string) {
        return this.pixelRepository.find({
            where: { storeId, isActive: true },
            select: ['id', 'type', 'pixelId', 'events', 'customData'],
        });
    }

    async togglePixelStatus(pixelId: string, userId: string) {
        const pixel = await this.pixelRepository.findOne({ where: { id: pixelId }, relations: ['store', 'store.user'] });
        if (!pixel || pixel.store.user.id !== userId) throw new NotFoundException('Pixel not found or you do not have permission');

        const newStatus = !pixel.isActive;
        if (newStatus === true) {
            await this.assertPixelLimitNotReached(userId, pixel.type as 'facebook' | 'tiktok',
                `لا يمكنك تفعيل هذا البكسل، لقد وصلت للحد الأقصى لبكسلات ${pixel.type} في خطتك.`
            );
        }

        pixel.isActive = newStatus;
        return this.pixelRepository.save(pixel);
    }

    // ==================== STORES ====================

    async createFullStore(dto: CreateFullStoreDto, userId: string) {
        await this.assertStoreLimitNotReached(userId);

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const { store: storeDto, design, topBar, contact, hero } = dto;

            // إنشاء المتجر
            const store = queryRunner.manager.create(Store, {
                name: storeDto.name,
                subdomain: storeDto.subdomain,
                currency: storeDto.currency,
                language: storeDto.language,
                user: { id: userId },
                niche: storeDto.nicheId ? { id: storeDto.nicheId } : null,
            } as any);
            const savedStore = await queryRunner.manager.save(Store, store);

            // إنشاء المكونات الإضافية
            await queryRunner.manager.save(StoreDesign, queryRunner.manager.create(StoreDesign, { ...design, store: savedStore }));
            await queryRunner.manager.save(StoreTopBar, queryRunner.manager.create(StoreTopBar, { ...topBar, store: savedStore }));
            await queryRunner.manager.save(StoreContact, queryRunner.manager.create(StoreContact, { ...contact, store: savedStore }));
            await queryRunner.manager.save(StoreHeroSection, queryRunner.manager.create(StoreHeroSection, { ...hero, store: savedStore }));
            await queryRunner.manager.save(Domain, queryRunner.manager.create(Domain, { domain: `${storeDto.subdomain}.mdstore.top`, isSub: true, isActive: true, store: savedStore }));

            // ─── استدعاء البيانات الوهمية داخل نفس الـ Transaction ───

            // 1. إنشاء الأصناف بناءً على النيش (لاحظ أن savedStore.id أصبح المعامل الأول)
            if (storeDto.nicheId) {
                await this.createFakeCategories(
                    savedStore.id,      // storeId (Required)
                    storeDto.nicheId,   // nicheId (Optional)
                    storeDto.language,
                    queryRunner.manager
                );
            } else {
                // اختياري: إذا أردت إنشاء أصناف افتراضية حتى لو لم يختر المستخدم نيش معين
                await this.createFakeCategories(savedStore.id, undefined, storeDto.language, queryRunner.manager);
            }

            // 2. إنشاء المنتجات التجريبية
            await this.createFakeProduct(savedStore.id, storeDto.language, queryRunner.manager);
            // ────────────────────────────────────────────────────────

            await queryRunner.commitTransaction();

            this.invalidateStoresCache(userId);

            return {
                id: savedStore.id,
                name: savedStore.name,
                subdomain: savedStore.subdomain,
                currency: savedStore.currency,
                language: savedStore.language,
                isActive: savedStore.isActive,
                createdAt: savedStore.createdAt,
                updatedAt: savedStore.updatedAt,
            };
        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    async updateFullStore(storeId: string, dto: UpdateFullStoreDto, userId?: string) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const where: any = { id: storeId };
            if (userId) where.user = { id: userId };

            const store = await queryRunner.manager.findOne(Store, {
                where,
                relations: ['design', 'topBar', 'contact', 'hero'],
            });
            if (!store) throw new NotFoundException('المتجر غير موجود أو لا تملك صلاحية الوصول');

            if (dto.store?.subdomain && dto.store.subdomain !== store.subdomain) {
                const newSubdomain = dto.store.subdomain.toLowerCase().trim();
                const isTaken = await queryRunner.manager.findOne(Store, { where: { subdomain: newSubdomain } });
                if (isTaken && isTaken.id !== storeId) throw new BadRequestException('هذا الرابط محجوز مسبقاً، اختر اسماً آخر');

                await queryRunner.manager.update(Domain,
                    { domain: `${store.subdomain}.mdstore.top`, store: { id: storeId } },
                    { domain: `${newSubdomain}.mdstore.top` }
                );
                store.subdomain = newSubdomain;
            }

            if (dto.store) {
                store.name = dto.store.name ?? store.name;
                store.currency = dto.store.currency ?? store.currency;
                store.language = dto.store.language ?? store.language;
                if (dto.store.nicheId) store.niche = { id: dto.store.nicheId } as any;
            }

            const syncSection = async (sectionKey: string, entityClass: any, data: any) => {
                if (!data) return;
                if (store[sectionKey]) {
                    Object.assign(store[sectionKey], data);
                    await queryRunner.manager.save(entityClass, store[sectionKey]);
                } else {
                    store[sectionKey] = queryRunner.manager.create(entityClass, { ...data, store: { id: store.id } });
                    await queryRunner.manager.save(entityClass, store[sectionKey]);
                }
            };

            await syncSection('design', StoreDesign, dto.design);
            await syncSection('topBar', StoreTopBar, dto.topBar);
            await syncSection('contact', StoreContact, dto.contact);
            await syncSection('hero', StoreHeroSection, dto.hero);

            await queryRunner.manager.save(Store, store);
            await queryRunner.commitTransaction();

            if (userId) this.invalidateStoresCache(userId);
            return this.getStore(storeId, userId);
        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw error;
        } finally {
            await queryRunner.release();
        }
    }

    async deleteStore(storeId: string, userId?: string) {
        const where: any = { id: storeId };
        if (userId) where.user = { id: userId };

        const store = await this.storeRepository.findOne({ where });
        if (!store) throw new NotFoundException('Store not found or you do not have permission');

        await this.storeRepository.remove(store);
        if (userId) this.invalidateStoresCache(userId);
        return { success: true, message: 'Store deleted successfully' };
    }

    async getStore(storeId: string, userId?: string) {
        const where: any = { id: storeId };
        if (userId) where.user = { id: userId };

        // ✅ حذف orders و products و shows من هنا — تسبب cartesian product
        const store = await this.storeRepository.findOne({
            where,
            relations: ['design', 'topBar', 'contact', 'hero', 'niche', 'user', 'pixels', 'themeUser'],
        });
        if (!store) throw new NotFoundException('Store not found or you do not have permission');
        return store;
    }

    async getStoreByDomain(subdomain: string, categoryId?: string, search?: string, page: string = '1') {
        const limit = 48;
        const currentPage = Math.max(1, parseInt(page) || 1);
        const skip = (currentPage - 1) * limit;

        // 1. جلب بيانات المتجر مع الـ Theme الجديد
        const store = await this.storeRepository
            .createQueryBuilder('store')
            .leftJoinAndSelect('store.domains', 'domains')
            .leftJoinAndSelect('store.design', 'design')
            .leftJoinAndSelect('store.topBar', 'topBar')
            .leftJoinAndSelect('store.contact', 'contact')
            .leftJoinAndSelect('store.hero', 'hero')
            .leftJoinAndSelect('store.categories', 'categories')
            .leftJoinAndSelect('store.pixels', 'pixels')
            .leftJoinAndSelect('store.theme', 'theme') // تم التصحيح هنا لربط جدول الثيمات
            .leftJoinAndSelect('store.user', 'user')
            .where('(store.subdomain = :identifier OR domains.domain = :identifier)', { identifier: subdomain })
            .addOrderBy('categories.sortOrder', 'ASC')
            .getOne();

        if (!store) return null;

        // 2. منطق جلب التصنيفات (كما هو)
        let categoryIds: string[] = [];
        if (categoryId) {
            const category = await this.categoryRepository.findOne({ where: { id: categoryId } });
            if (category) {
                // ملاحظة: تأكد أن TreeRepository يعمل مع categoryRepository
                const descendants = await this.categoryRepository.findDescendants(category);
                categoryIds = descendants.map(c => c.id);
            }
        }

        // 3. استعلام المنتجات
        const productQuery = this.dataSource.getRepository(Product)
            .createQueryBuilder('products')
            .leftJoinAndSelect('products.imagesProduct', 'imagesProduct')
            .leftJoinAndSelect('products.category', 'productCategory')
            .where('products.storeId = :storeId AND products.isActive = true', { storeId: store.id });

        if (categoryIds.length > 0) {
            productQuery.andWhere('products.categoryId IN (:...categoryIds)', { categoryIds });
        }

        if (search) {
            productQuery.andWhere('(products.name ILIKE :search OR products.desc ILIKE :search)', { search: `%${search}%` });
        }

        const [products, totalItems] = await productQuery
            .orderBy('products.createdAt', 'DESC')
            .skip(skip)
            .take(limit)
            .getManyAndCount();

        // 4. إجمالي المنتجات العام
        const totalCount = await this.dataSource.getRepository(Product).count({
            where: { store: { id: store.id }, isActive: true }
        });

        // 5. دمج النتائج النهائية وإرسالها
        return {
            ...store,
            products,
            count: totalCount,
            meta: {
                totalItems,
                itemCount: products.length,
                itemsPerPage: limit,
                totalPages: Math.ceil(totalItems / limit),
                currentPage: currentPage
            }
        };
    }
    async deactivateAllStores(userId: string) {
        await this.storeRepository.update({ user: { id: userId } }, { isActive: false });
        this.invalidateStoresCache(userId);
        return { success: true, message: 'All stores have been deactivated.' };
    }

    async activateFirstStoreOnly(userId: string) {
        const userStores = await this.storeRepository.find({
            where: { user: { id: userId } },
            order: { createdAt: 'ASC' },
        });
        if (userStores.length === 0) throw new NotFoundException('No stores found for this user.');

        await this.storeRepository.update({ user: { id: userId } }, { isActive: false });
        await this.storeRepository.update({ id: userStores[0].id }, { isActive: true });
        this.invalidateStoresCache(userId);

        return { success: true, activatedStore: userStores[0].name };
    }

    // ✅ الدالة الرئيسية — بدل JOIN يسبب cartesian product
    async getAllStores(userId?: string) {
        if (userId) {
            const cached = this.getCachedStores(userId);
            if (cached) return cached;
        }

        const qb = this.storeRepository
            .createQueryBuilder('store')
            .leftJoinAndSelect('store.design', 'design')
            .leftJoinAndSelect('store.topBar', 'topBar')
            .leftJoinAndSelect('store.contact', 'contact')
            .leftJoinAndSelect('store.niche', 'niche')
            .leftJoinAndSelect('store.pixels', 'pixels')
            // ✅ COUNT subqueries بدل JOIN — لا cartesian product
            .loadRelationCountAndMap('store.ordersCount', 'store.orders')
            .loadRelationCountAndMap('store.productsCount', 'store.products')
            .loadRelationCountAndMap('store.showsCount', 'store.shows');

        if (userId) qb.where('store.userId = :userId', { userId });

        const result = await qb.getMany();

        if (userId) this.storesCache.set(userId, { data: result, ts: Date.now() });
        return result;
    }

    // ==================== TOGGLE STATUS ====================

    async toggleStatus(storeId: string, userId: string) {
        const store = await this.storeRepository.findOne({ where: { id: storeId }, select: ['id', 'isActive'] });
        if (!store) throw new NotFoundException('Store not found');

        const newStatus = !store.isActive;
        if (newStatus === true) await this.assertStoreLimitNotReached(userId);

        await this.storeRepository.update({ id: storeId }, { isActive: newStatus });
        this.invalidateStoresCache(userId);
        return { success: true, isActive: newStatus };
    }

    async toggleStatusWithAuth(storeId: string, userId: string) {
        const store = await this.storeRepository.findOne({
            where: { id: storeId, user: { id: userId } },
            select: ['id', 'isActive', 'name'],
        });
        if (!store) throw new NotFoundException('Store not found or you do not have permission');

        const newStatus = !store.isActive;
        if (newStatus === true) await this.assertStoreLimitNotReached(userId);

        await this.storeRepository.update({ id: storeId }, { isActive: newStatus });
        this.invalidateStoresCache(userId);
        return { success: true, isActive: newStatus, message: `Store "${store.name}" has been ${newStatus ? 'activated' : 'deactivated'}` };
    }

    async bulkToggleStatus(storeIds: string[], isActive: boolean) {
        const result = await this.storeRepository
            .createQueryBuilder()
            .update(Store)
            .set({ isActive })
            .where('id IN (:...storeIds)', { storeIds })
            .execute();

        return { success: true, updated: result.affected || 0 };
    }

    async verifyOwnership(storeId: string, userId: string): Promise<Store> {
        // ✅ select فقط id و userId — لا نحتاج كل الحقول
        const store = await this.storeRepository.findOne({
            where: { id: storeId, user: { id: userId } },
            select: ['id'],
            relations: ['user'],
        });
        if (!store) throw new NotFoundException('المتجر غير موجود أو ليس لديك صلاحية الوصول إليه');
        if (store.user.id !== userId) throw new ForbiddenException('ليس لديك صلاحية الوصول لهذا المتجر');
        return store;
    }


    async createFakeCategories(storeId: string, nicheId?: string, language: string = "ar", manager?: any) {
        let categoryNiche: any = [];

        // 1. تصحيح النطاق: جلب بيانات النيش إذا وجد المعرف
        if (nicheId) {
            // إذا كان هناك manager (Transaction)، نستخدمه لجلب البيانات أيضاً لضمان الاتساق
            const repo = manager ? manager.getRepository(CategoryNiche) : this.cateNicheRepo;
            categoryNiche = await repo.find({ where: { nicheId } });
        }

        let listCategories: any = [];

        // 2. التحقق من وجود بيانات في النيش
        if (categoryNiche && categoryNiche.length > 0) {
            listCategories = categoryNiche.map(cat => ({
                name: language === "ar" ? cat.name_ar : language === "fr" ? cat.name_fr : cat.name_en,
                imageUrl: cat.imageUrl,
                slug: (cat.name_en || 'cat').toLowerCase().trim().replace(/\s+/g, '-'),
                store: { id: storeId }
            }));
        } else {
            // 3. بيانات افتراضية في حال عدم وجود نيش أو عدم العثور على تصنيفات له
            const defaultNames = {
                ar: ["الصنف الأول", "الصنف الثاني", "الصنف الثالث"],
                fr: ["Catégorie 1", "Catégorie 2", "Catégorie 3"],
                en: ["Category 1", "Category 2", "Category 3"]
            };

            // التأكد من اختيار مفتاح لغة صالح
            const langKey = (["ar", "fr", "en"].includes(language)) ? language : "en";

            listCategories = defaultNames[langKey].map((name, i) => ({
                name,
                imageUrl: "https://via.placeholder.com/150",
                slug: `category-${i + 1}-${Date.now()}`, // إضافة timestamp بسيط لضمان فرادة الـ slug
                store: { id: storeId }
            }));
        }

        // 4. التنفيذ باستخدام الـ manager الممرر أو الـ repository الافتراضي
        const targetRepo = manager ? manager : this.categoryRepository;

        const categories = targetRepo.create(Category, listCategories);
        return await targetRepo.save(Category, categories);
    }

    async createFakeProduct(storeId: string, language: string = "ar", manager?: any) {
        const productsData = [
            {
                "name_ar": "عطر الورد الكلاسيكي", "name_fr": "Parfum de Rose Classique", "name_en": "Classic Rose Perfume",
                "price": 1200, "images": ["https://pub-4e93f8cd6d974b8c946ea7201337df2f.r2.dev/admin/626abb0f-2821-4e57-95c3-750e2381f2fb.jpg"],
                "desc_en": "Classic Rose Perfume description", "desc_ar": "وصف عطر الورد الكلاسيكي", "desc_fr": "Description parfum rose"
            },
            {
                "name_ar": "شمعة عطرية مهدئة", "name_fr": "Bougie Parfumée Apaisante", "name_en": "Soothing Scented Candle",
                "price": 450, "images": ["https://pub-4e93f8cd6d974b8c946ea7201337df2f.r2.dev/admin/4e2e1966-f3eb-43a1-aff2-cda34ddb4f54.jpg"],
                "desc_en": "Soothing Scented Candle description", "desc_ar": "وصف شمعة عطرية مهدئة", "desc_fr": "Description bougie"
            },
            {
                "name_ar": "نظارة شمسية عصرية", "name_fr": "Lunettes de Soleil Modernes", "name_en": "Modern Sunglasses",
                "price": 850, "images": ["https://pub-4e93f8cd6d974b8c946ea7201337df2f.r2.dev/admin/ba8013bb-dca8-4805-8fe9-1a7cca3c0ecf.jpg"],
                "desc_ar": "<p>نظارة بتصميم كلاسيكي توفر حماية كاملة من الأشعة فوق البنفسجية.</p>", "desc_fr": "<p>Lunettes au design classique offrant une protection totale contre les rayons UV.</p>", "desc_en": "<p>Classic design sunglasses providing full UV protection.</p>",
            },
            {
                "name_ar": "حقيبة يد جلدية", "name_fr": "Sac à Main en Cuir", "name_en": "Leather Handbag",
                "price": 2300, "images": ["https://pub-4e93f8cd6d974b8c946ea7201337df2f.r2.dev/admin/5ac3d207-7b83-4017-8bd8-76a7f33aa422.jpg"],
                "desc_ar": "<p>حقيبة يد فاخرة مصنوعة من الجلد الطبيعي بتصميم أنيق وعملي.</p>", "desc_fr": "<p>Sac à main de luxe en cuir véritable au design élégant et pratique.</p>", "desc_en": "<p>Luxury handbag made of genuine leather with an elegant and practical design.</p>",
            }
        ];

        const targetManager = manager || this.dataSource.manager;
        const finalSavedProducts: Product[] = [];

        for (const item of productsData) {
            // تأكد من ملء جميع الحقول هنا وعدم تركها فارغة
            const product = targetManager.create(Product, {
                name: language === "ar" ? item.name_ar : language === "fr" ? item.name_fr : item.name_en,
                desc: language === "ar" ? item.desc_ar : language === "fr" ? item.desc_fr : item.desc_en,
                price: item.price,
                store: { id: storeId },
                productImage: item.images[0], // الصورة الأساسية
                isActive: true,
                stock: 100,
                attributes: [],
                variantDetails: [],
                offers: []
            });

            // حفظ المنتج (هنا كان يحدث الخطأ بسبب نقص الحقول)
            const saved = await targetManager.save(Product, product);
            finalSavedProducts.push(saved);

            // حفظ الصور في جدول الصور المنفصل
            if (item.images?.length) {
                const imageEntities = item.images.map(url =>
                    targetManager.create(ImageProduct, { imageUrl: url, product: saved })
                );
                await targetManager.save(ImageProduct, imageEntities);
            }
        }

        return finalSavedProducts;
    }
}

/* 



*/

