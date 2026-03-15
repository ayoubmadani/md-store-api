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

        private readonly subscriptionService: SubscriptionService
    ) { }

    // ==================== PIXELS ====================

    async addPixel(storeId: string, dto: CreatePixelDto, userId: string) {
        const store = await this.storeRepository.findOne({
            where: { id: storeId, user: { id: userId } },
        });

        if (!store) {
            throw new NotFoundException('Store not found or you do not have permission');
        }

        const existingPixel = await this.pixelRepository.findOne({
            where: { storeId, type: dto.type, isActive: true },
        });

        if (existingPixel) {
            throw new BadRequestException(`Active ${dto.type} pixel already exists for this store`);
        }

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

        if (!store) {
            throw new NotFoundException('Store not found or you do not have permission');
        }

        return this.pixelRepository.find({
            where: { storeId },
            order: { createdAt: 'DESC' },
        });
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

        pixel.isActive = !pixel.isActive;
        return this.pixelRepository.save(pixel);
    }

    // ==================== STORES ====================

    async createFullStore(dto: CreateFullStoreDto, userId: string) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        const getSub = await this.subscriptionService.findSub(userId)
        const countStore = await this.storeRepository.count({ where: { user: { id: userId }, isActive: true } })



        if (getSub?.plan.name === "free" && countStore >= 1) {
            throw new BadRequestException('You have reached the maximum limit of stores for the Free plan (1 store).');
        }

        if (getSub?.plan.name === "pro" && countStore >= 10) {
            throw new BadRequestException('You have reached the maximum limit of stores for the Pro plan (10 stores).');
        }




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

            const storeTopBar = queryRunner.manager.create(StoreTopBar, { ...topBar, store: savedStore });
            await queryRunner.manager.save(StoreTopBar, storeTopBar);

            const storeContact = queryRunner.manager.create(StoreContact, { ...contact, store: savedStore });
            await queryRunner.manager.save(StoreContact, storeContact);

            const storeHero = queryRunner.manager.create(StoreHeroSection, { ...hero, store: savedStore });
            await queryRunner.manager.save(StoreHeroSection, storeHero);

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
                topBar,
                contact,
                hero,
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

            if (dto.store) {
                Object.assign(store, {
                    name: dto.store.name ?? store.name,
                    subdomain: dto.store.subdomain ?? store.subdomain,
                    currency: dto.store.currency ?? store.currency,
                    language: dto.store.language ?? store.language,
                });
                store.niche = { id: dto.store.nicheId } as any;
            }

            if (dto.design && store.design) {
                Object.assign(store.design, dto.design);
                await queryRunner.manager.save(StoreDesign, store.design);
            }

            if (dto.topBar && store.topBar) {
                Object.assign(store.topBar, dto.topBar);
                await queryRunner.manager.save(StoreTopBar, store.topBar);
            }

            if (dto.contact && store.contact) {
                Object.assign(store.contact, dto.contact);
                await queryRunner.manager.save(StoreContact, store.contact);
            }

            if (dto.hero && store.hero) {
                Object.assign(store.hero, dto.hero);
                await queryRunner.manager.save(StoreHeroSection, store.hero);
            }

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

    // store.service.ts
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
            // جلب سجل امتلاك الثيم
            .leftJoinAndSelect('store.themeUser', 'themeUser')
            // جلب بيانات الثيم نفسه (الاسم، المسار، إلخ)
            .leftJoinAndSelect('themeUser.theme', 'theme')
            .leftJoinAndSelect(
                'store.products',
                'products',
                categoryId && categoryIds.length > 0
                    ? 'products.isActive = true AND products.categoryId IN (:...categoryIds)'
                    : 'products.isActive = true',
                categoryIds.length > 0 ? { categoryIds } : {}
            )
            .leftJoinAndSelect('products.imagesProduct', 'imagesProduct')
            .leftJoinAndSelect('products.category', 'productCategory')
            .where('store.subdomain = :subdomain', { subdomain });

        qb.addOrderBy('categories.sortOrder', 'ASC');

        return qb.getOne();
    }

    async deactivateAllStores(userId: string) {
        await this.storeRepository.update(
            { user: { id: userId } },
            { isActive: false }
        );
        return { success: true, message: 'All stores have been deactivated.' };
    }

    async activateFirstStoreOnly(userId: string) {
        // 1. جلب كافة متاجر المستخدم مرتبة من الأقدم إلى الأحدث
        const userStores = await this.storeRepository.find({
            where: { user: { id: userId } },
            order: { createdAt: 'ASC' }
        });

        if (userStores.length === 0) {
            throw new NotFoundException('No stores found for this user.');
        }

        // 2. تحديث الحالة في قاعدة البيانات
        // تعطيل الكل أولاً
        await this.storeRepository.update({ user: { id: userId } }, { isActive: false });

        // تفعيل المتجر الأول فقط
        const firstStoreId = userStores[0].id;
        await this.storeRepository.update({ id: firstStoreId }, { isActive: true });

        return {
            success: true,
            activatedStore: userStores[0].name,
            message: 'First store activated, others deactivated to comply with limits.'
        };
    }

    async getAllStores(userId?: string) {
        const query = this.storeRepository
            .createQueryBuilder('store')
            .leftJoinAndSelect('store.design', 'design')
            .leftJoinAndSelect('store.topBar', 'topBar')
            .leftJoinAndSelect('store.contact', 'contact')
            .leftJoinAndSelect('store.hero', 'hero')
            .leftJoinAndSelect('store.products', 'products')
            .leftJoinAndSelect('store.categories', 'categories')
            .leftJoinAndSelect('store.niche', 'niche')
            .leftJoinAndSelect('store.user', 'user')
            .leftJoinAndSelect('store.pixels', 'pixels');

        if (userId) query.where('user.id = :userId', { userId });

        return query.getMany();
    }

    // ==================== TOGGLE STATUS ====================

    async toggleStatus(storeId: string, userId): Promise<{ success: boolean; isActive: boolean; message: string }> {

        const getSub = await this.subscriptionService.findSub(userId)
        const countStore = await this.storeRepository.count({ where: { user: { id: userId }, isActive: true } })

        console.log(countStore);


        if (getSub?.plan.name === "free" && countStore > 1) {
            throw new BadRequestException('You have reached the maximum limit of stores for the Free plan (1 store).');
        }

        if (getSub?.plan.name === "pro" && countStore > 10) {
            throw new BadRequestException('You have reached the maximum limit of stores for the Pro plan (10 stores).');
        }

        if (!getSub && countStore >= 1) {
            throw new BadRequestException('You have reached the maximum limit of stores for the Free plan (1 store).');
        }

        const store = await this.storeRepository.findOne({
            where: { id: storeId },
            select: ['id', 'isActive'],
        });

        if (!store) throw new NotFoundException('Store not found');

        const newStatus = !store.isActive;
        await this.storeRepository.update({ id: storeId }, { isActive: newStatus });

        return {
            success: true,
            isActive: newStatus,
            message: newStatus ? 'Store activated successfully' : 'Store deactivated successfully',
        };
    }

    async toggleStatusWithAuth(storeId: string, userId: string): Promise<{ success: boolean; isActive: boolean; message: string }> {

        const getSub = await this.subscriptionService.findSub(userId)
        const countStore = await this.storeRepository.count({ where: { user: { id: userId }, isActive: true } })

        console.log(getSub?.plan.name);

        const store = await this.storeRepository.findOne({
            where: { id: storeId, user: { id: userId } },
            select: ['id', 'isActive', 'name'],
        });

        if (!store) throw new NotFoundException('Store not found or you do not have permission');

        const newStatus = !store.isActive;

        if (newStatus === true) {
            if (getSub?.plan.name.toLowerCase() === "free" && countStore >= 1) {
                throw new BadRequestException('You have reached the maximum limit of stores for the Free plan (1 store).');
            }

            if (getSub?.plan.name === "pro" && countStore >= 10) {
                throw new BadRequestException('You have reached the maximum limit of stores for the Pro plan (10 stores).');
            }

            if (!getSub && countStore >= 1) {
                throw new BadRequestException('You have reached the maximum limit of stores for the Free plan (1 store).');
            }
        }

        await this.storeRepository.update({ id: storeId }, { isActive: newStatus });

        return {
            success: true,
            isActive: newStatus,
            message: `Store "${store.name}" has been ${newStatus ? 'activated' : 'deactivated'}`,
        };
    }

    async bulkToggleStatus(storeIds: string[], isActive: boolean): Promise<{ success: boolean; updated: number; message: string }> {
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
            where: {
                id: storeId,
                user: { id: userId } // البحث عن المتجر وعلاقة المستخدم معاً
            },
            relations: ['user'], // ✅ ضروري جداً لكي يعمل سطر (store.user.id)
        });

        if (!store) {
            // إذا لم يجد المتجر بهذا المعرف وبهذا المستخدم، ارمِ استثناء
            throw new NotFoundException(`المتجر غير موجود أو ليس لديك صلاحية الوصول إليه`);
        }

        // التحقق هنا أصبح إضافياً (Redundant) لأن الـ where قامت بالمهمة
        // ولكن نتركه للأمان طالما أضفنا الـ relations
        if (store.user.id !== userId) {
            throw new ForbiddenException('ليس لديك صلاحية الوصول لهذا المتجر');
        }

        return store;
    }
}