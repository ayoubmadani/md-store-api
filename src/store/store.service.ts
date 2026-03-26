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

@Injectable()
export class StoreService {
    constructor(
        private readonly dataSource: DataSource,
        @InjectRepository(Store)
        private readonly storeRepository: Repository<Store>,
        @InjectRepository(StorePixel)
        private readonly pixelRepository: Repository<StorePixel>,
        @InjectRepository(Category)
        private categoryRepository: TreeRepository<Category>,
        private readonly subscriptionService: SubscriptionService,
    ) { }

    // ─── helper: جلب الحد المسموح من الـ features ──────────────────────────────
    private async getStoreLimit(userId: string): Promise<number> {
        const sub = await this.subscriptionService.findSub(userId);
        // features.storeNumber هو المصدر الحقيقي للحد — لا اسم الخطة
        return sub?.plan?.features?.storeNumber ?? 1;
    }

    private async assertStoreLimitNotReached(userId: string, extraMessage?: string): Promise<void> {
        const [limit, count] = await Promise.all([
            this.getStoreLimit(userId),
            this.storeRepository.count({ where: { user: { id: userId }, isActive: true } }),
        ]);

        if (count >= limit) {
            throw new BadRequestException(
                extraMessage ?? `لقد وصلت إلى الحد الأقصى للمتاجر النشطة في خطتك (${limit} متاجر).`
            );
        }
    }

    // ─── helper: جلب الحد المسموح لكل نوع بكسل ──────────────────────────────
    private async getPixelLimit(userId: string, type: 'facebook' | 'tiktok'): Promise<number> {
        const sub = await this.subscriptionService.findSub(userId);

        const limit = type === 'facebook'
            ? sub?.plan?.features?.pixelFacebookNumber
            : sub?.plan?.features?.pixelTiktokNumber;

        return limit ?? 0;
    }

    private async assertPixelLimitNotReached(userId: string, type: 'facebook' | 'tiktok', extraMessage?: string): Promise<void> {
        const [limit, count] = await Promise.all([
            this.getPixelLimit(userId, type),
            // نعد البكسلات النشطة من نفس النوع فقط لهذا المستخدم عبر كل متاجره
            this.pixelRepository.count({
                where: {
                    type, // مهم جداً فلترة النوع هنا
                    store: { user: { id: userId } },
                    isActive: true
                }
            }),
        ]);

        if (count >= limit) {
            throw new BadRequestException(
                extraMessage ?? `لقد وصلت إلى الحد الأقصى لبكسلات ${type} في خطتك الحالية (${limit}).`
            );
        }
    }

    // ==================== PIXELS ====================

    async addPixel(storeId: string, dto: CreatePixelDto, userId: string) {
        // 1. التأكد من وجود المتجر وصلاحية المستخدم
        const store = await this.storeRepository.findOne({
            where: { id: storeId, user: { id: userId } },
        });
        if (!store) throw new NotFoundException('Store not found or you do not have permission');

        // 2. التحقق من الحد الأقصى الإجمالي المسموح به للمستخدم (حسب نوع البكسل)
        // هذا الفحص يتأكد أن المستخدم لم يتجاوز مثلاً الـ 5 بكسلات المتاحة في خطته
        await this.assertPixelLimitNotReached(userId, dto.type as 'facebook' | 'tiktok');

        // 3. التحقق من "تكرار نفس المعرف" (اختياري ولكن ينصح به)
        // لمنع المستخدم من إضافة نفس الـ Pixel ID مرتين لنفس المتجر بالخطأ
        const duplicatePixelId = await this.pixelRepository.findOne({
            where: { storeId, pixelId: dto.pixelId, type: dto.type, isActive: true },
        });
        if (duplicatePixelId) {
            throw new BadRequestException(`هذا البكسل (ID: ${dto.pixelId}) مضاف بالفعل لهذا المتجر.`);
        }

        // 4. إنشاء وحفظ البكسل الجديد
        // الآن يمكن إضافة بكسل تيك توك ثانٍ لنفس المتجر طالما لم يتجاوز الـ Limit العام
        const pixel = this.pixelRepository.create({ ...dto, storeId });
        return this.pixelRepository.save(pixel);
    }

    async updatePixel(pixelId: string, dto: UpdatePixelDto, userId: string) {
        const pixel = await this.pixelRepository.findOne({
            where: { id: pixelId },
            relations: ['store', 'store.user'],
        });
        if (!pixel || pixel.store.user.id !== userId) {
            throw new NotFoundException('Pixel not found or you do not have permission');
        }
        Object.assign(pixel, dto);
        return this.pixelRepository.save(pixel);
    }

    async deletePixel(pixelId: string, userId: string) {
        const pixel = await this.pixelRepository.findOne({
            where: { id: pixelId },
            relations: ['store', 'store.user'],
        });
        if (!pixel || pixel.store.user.id !== userId) {
            throw new NotFoundException('Pixel not found or you do not have permission');
        }
        await this.pixelRepository.remove(pixel);
        return { success: true, message: 'Pixel deleted successfully' };
    }

    async getStorePixels(storeId: string, userId: string) {
        const store = await this.storeRepository.findOne({
            where: { id: storeId, user: { id: userId } },
        });
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
        const pixel = await this.pixelRepository.findOne({
            where: { id: pixelId },
            relations: ['store', 'store.user'],
        });

        if (!pixel || pixel.store.user.id !== userId) {
            throw new NotFoundException('Pixel not found or you do not have permission');
        }

        // 1. تحديد الحالة الجديدة المستهدفة
        const newStatus = !pixel.isActive;

        // 2. إذا كان المستخدم يحاول "تفعيل" البكسل (من false إلى true)
        if (newStatus === true) {
            // نتحقق مما إذا كان سيتحاوز الحد المسموح به لهذا النوع (facebook/tiktok)
            await this.assertPixelLimitNotReached(
                userId,
                pixel.type as 'facebook' | 'tiktok',
                `لا يمكنك تفعيل هذا البكسل، لقد وصلت للحد الأقصى لبكسلات ${pixel.type} في خطتك.`
            );
        }

        // 3. تحديث الحالة وحفظ التغييرات
        pixel.isActive = newStatus;
        return this.pixelRepository.save(pixel);
    }

    // ==================== STORES ====================

    async createFullStore(dto: CreateFullStoreDto, userId: string) {
        // ← فحص الحد قبل فتح transaction
        await this.assertStoreLimitNotReached(userId);

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const { store: storeDto, design, topBar, contact, hero } = dto;

            const store = queryRunner.manager.create(Store, {
                name: storeDto.name,
                subdomain: storeDto.subdomain,
                currency: storeDto.currency,
                language: storeDto.language,
                user: { id: userId },
                niche: storeDto.nicheId ? { id: storeDto.nicheId } : null,
            } as any);
            const savedStore = await queryRunner.manager.save(Store, store);

            const storeDesign = queryRunner.manager.create(StoreDesign, { ...design, store: savedStore });
            const savedDesign = await queryRunner.manager.save(StoreDesign, storeDesign);

            await queryRunner.manager.save(StoreTopBar, queryRunner.manager.create(StoreTopBar, { ...topBar, store: savedStore }));
            await queryRunner.manager.save(StoreContact, queryRunner.manager.create(StoreContact, { ...contact, store: savedStore }));
            await queryRunner.manager.save(StoreHeroSection, queryRunner.manager.create(StoreHeroSection, { ...hero, store: savedStore }));

            await queryRunner.commitTransaction();

            const { store: _, ...designWithoutStore } = savedDesign;
            return {
                id: savedStore.id,
                name: savedStore.name,
                subdomain: savedStore.subdomain,
                currency: savedStore.currency,
                language: savedStore.language,
                isActive: savedStore.isActive,
                createdAt: savedStore.createdAt,
                updatedAt: savedStore.updatedAt,
                design: designWithoutStore,
                topBar, contact, hero,
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

            if (!store) throw new NotFoundException('Store not found or you do not have permission');

            // تحديث بيانات المتجر الأساسية
            if (dto.store) {
                Object.assign(store, {
                    name: dto.store.name ?? store.name,
                    subdomain: dto.store.subdomain ?? store.subdomain,
                    currency: dto.store.currency ?? store.currency,
                    language: dto.store.language ?? store.language,
                });
                if (dto.store.nicheId) {
                    store.niche = { id: dto.store.nicheId } as any;
                }
            }

            // دالة مساعدة لتحديث أو إنشاء الكائنات المرتبطة
            const syncSection = async (sectionKey: string, entityClass: any, data: any) => {
                if (!data) return;

                if (store[sectionKey]) {
                    // تحديث الموجود
                    Object.assign(store[sectionKey], data);
                    await queryRunner.manager.save(entityClass, store[sectionKey]);
                } else {
                    // إنشاء جديد إذا كان null
                    store[sectionKey] = queryRunner.manager.create(entityClass, {
                        ...data,
                        store: { id: store.id } // ربطه بالمتجر
                    });
                    await queryRunner.manager.save(entityClass, store[sectionKey]);
                }
            };

            // تنفيذ المزامنة لكل الأقسام
            await syncSection('design', StoreDesign, dto.design);
            await syncSection('topBar', StoreTopBar, dto.topBar);
            await syncSection('contact', StoreContact, dto.contact);
            await syncSection('hero', StoreHeroSection, dto.hero);

            await queryRunner.manager.save(Store, store);
            await queryRunner.commitTransaction();

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
        return { success: true, message: 'Store deleted successfully' };
    }

    async getStore(storeId: string, userId?: string) {
        const where: any = { id: storeId };
        if (userId) where.user = { id: userId };

        const store = await this.storeRepository.findOne({
            where,
            relations: ['design', 'topBar', 'contact', 'orders', 'hero', 'products', 'categories', 'niche', 'user', 'pixels', 'themeUser'],
        });
        if (!store) throw new NotFoundException('Store not found or you do not have permission');
        return store;
    }

    async getStoreByDomain(subdomain: string, categoryId?: string) {
        let categoryIds: string[] = [];

        if (categoryId) {
            const category = await this.categoryRepository.findOne({ where: { id: categoryId } });
            if (category) {
                const descendants = await this.categoryRepository.findDescendants(category);
                categoryIds = descendants.map(c => c.id);
            }
        }

        const qb = this.storeRepository
            .createQueryBuilder('store')
            .leftJoinAndSelect('store.design', 'design')
            .leftJoinAndSelect('store.topBar', 'topBar')
            .leftJoinAndSelect('store.contact', 'contact')
            .leftJoinAndSelect('store.hero', 'hero')
            .leftJoinAndSelect('store.categories', 'categories')
            .leftJoinAndSelect('store.pixels', 'pixels')
            .leftJoinAndSelect('store.themeUser', 'themeUser')
            .leftJoinAndSelect('themeUser.theme', 'theme')
            .leftJoinAndSelect(
                'store.products',
                'products',
                categoryId && categoryIds.length > 0
                    ? 'products.isActive = true AND products.categoryId IN (:...categoryIds)'
                    : 'products.isActive = true',
                categoryIds.length > 0 ? { categoryIds } : {},
            )
            .leftJoinAndSelect('products.imagesProduct', 'imagesProduct')
            .leftJoinAndSelect('products.category', 'productCategory')

            // التعديل السحري هنا لدعم الدومين المخصص
            .where('(store.subdomain = :subdomain OR store.customDomain = :subdomain)', { subdomain })

            .addOrderBy('categories.sortOrder', 'ASC');

        const store = await qb.getOne();

        // حماية إضافية: إذا لم يجد المتجر، لا نترك الكود ينهار
        if (!store) {
            console.error(`Store not found for identifier: ${subdomain}`);
            return null;
        }

        return store;
    }

    async deactivateAllStores(userId: string) {
        await this.storeRepository.update({ user: { id: userId } }, { isActive: false });
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

        return {
            success: true,
            activatedStore: userStores[0].name,
            message: 'First store activated, others deactivated to comply with limits.',
        };
    }


    async getAllStores(userId?: string) {
        const query = this.storeRepository
            .createQueryBuilder('store')
            .leftJoinAndSelect('store.design', 'design')
            .leftJoinAndSelect('store.topBar', 'topBar')
            .leftJoinAndSelect('store.contact', 'contact')
            .leftJoinAndSelect('store.hero', 'hero')
            .leftJoinAndSelect('store.niche', 'niche')
            .leftJoinAndSelect('store.user', 'user')
            .leftJoinAndSelect('store.pixels', 'pixels')
            .leftJoinAndSelect('store.shows', 'shows')
            .leftJoinAndSelect('store.orders', 'orders')
            .leftJoinAndSelect('store.products', 'products')

        if (userId) {
            query.andWhere('store.user.id = :userId', { userId });
        }

        const { entities, raw } = await query.getRawAndEntities();

        // دمج البيانات الخام (Raw) مع الكيانات (Entities)
        return entities.map((store, index) => {
            const rawData = raw[index];
            return {
                ...store,
                viewsCount: parseInt(rawData?.viewsCount || '0', 10),
                productsCount: parseInt(rawData?.productsCount || '0', 10),
            };
        });
    }

    // ==================== TOGGLE STATUS ====================

    async toggleStatus(storeId: string, userId: string) {
        const store = await this.storeRepository.findOne({
            where: { id: storeId },
            select: ['id', 'isActive'],
        });
        if (!store) throw new NotFoundException('Store not found');

        const newStatus = !store.isActive;

        // الفحص فقط عند التفعيل — التعطيل دائماً مسموح
        if (newStatus === true) {
            await this.assertStoreLimitNotReached(userId);
        }

        await this.storeRepository.update({ id: storeId }, { isActive: newStatus });
        return {
            success: true,
            isActive: newStatus,
            message: newStatus ? 'Store activated successfully' : 'Store deactivated successfully',
        };
    }

    async toggleStatusWithAuth(storeId: string, userId: string) {
        const store = await this.storeRepository.findOne({
            where: { id: storeId, user: { id: userId } },
            select: ['id', 'isActive', 'name'],
        });
        if (!store) throw new NotFoundException('Store not found or you do not have permission');

        const newStatus = !store.isActive;

        if (newStatus === true) {
            await this.assertStoreLimitNotReached(userId);
        }

        await this.storeRepository.update({ id: storeId }, { isActive: newStatus });
        return {
            success: true,
            isActive: newStatus,
            message: `Store "${store.name}" has been ${newStatus ? 'activated' : 'deactivated'}`,
        };
    }

    async bulkToggleStatus(storeIds: string[], isActive: boolean) {
        const result = await this.storeRepository
            .createQueryBuilder()
            .update(Store)
            .set({ isActive })
            .where('id IN (:...storeIds)', { storeIds })
            .execute();

        return {
            success: true,
            updated: result.affected || 0,
            message: `${result.affected} stores have been ${isActive ? 'activated' : 'deactivated'}`,
        };
    }

    async verifyOwnership(storeId: string, userId: string): Promise<Store> {
        const store = await this.storeRepository.findOne({
            where: { id: storeId, user: { id: userId } },
            relations: ['user'],
        });
        if (!store) throw new NotFoundException('المتجر غير موجود أو ليس لديك صلاحية الوصول إليه');
        if (store.user.id !== userId) throw new ForbiddenException('ليس لديك صلاحية الوصول لهذا المتجر');
        return store;
    }
}