import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { WilayaDto } from "./dto/wilaya.dto";
import { InjectRepository } from "@nestjs/typeorm";
import { Wilaya } from "./entity/wilaya.entity";
import { Repository, In } from "typeorm";
import { Commune } from "./entity/commune.entity";
import { CommuneDto } from "./dto/commune.dto";
import { Shipping } from "./entity/shipping.entity";
import { JsonWilayaDto } from "./dto/jsonWilaya.dto";
import { ShippingProfile } from "./entity/shipping-profile.entity";
import { Store } from "../store/entities/store.entity";

@Injectable()
export class ShippingService {
    constructor(
        @InjectRepository(Wilaya) private readonly wilayaRepo: Repository<Wilaya>,
        @InjectRepository(Commune) private readonly communesRepo: Repository<Commune>,
        @InjectRepository(Shipping) private readonly shippingRepo: Repository<Shipping>,
        @InjectRepository(ShippingProfile) private readonly profileRepo: Repository<ShippingProfile>,
        @InjectRepository(Store) private readonly storeRepo: Repository<Store>,
    ) { }

    /* wilayas */

    async createWilayas(wilayas: WilayaDto[]) {
        const creationPromises = wilayas.map(async (wilaya) => {
            const newWilaya = this.wilayaRepo.create({
                id: wilaya.id,
                name: wilaya.name,
                ar_name: wilaya.ar_name
            });
            return this.wilayaRepo.save(newWilaya);
        });

        await Promise.all(creationPromises);
    }

    async getAllWilayas() {
        return this.wilayaRepo.find({ order: { id: "ASC" } })
    }

    /*communes */

    async createCommunes(communes: CommuneDto[]) {
        // 1. تحويل الـ DTOs إلى كائنات تتوافق مع الـ Entity
        const communeEntities: any = communes.map(commune => {
            return this.communesRepo.create({
                id: commune.id,
                name: commune.name,
                ar_name: commune.ar_name,
                post_code: commune.post_code,
                // تأكد أن الاسم في الـ Entity هو wilayaId أو wilaya_id حسب ما اخترت
                wilayaId: commune.wilaya_id
            } as any);
        });

        // 2. حفظ المصفوفة كاملة في طلب واحد (أسرع بـ 100 مرة)
        return await this.communesRepo.save(communeEntities);
    }

    async getAllCommunesById(wilayaId: number) {
        return this.communesRepo.find({ where: { wilayaId } })
    }

    /* حسابات الشحن */

    // الحساب الافتراضي للتاجر (يُنشأ تلقائياً عند أول حاجة إليه)
    async getDefaultProfile(userId: string): Promise<ShippingProfile> {
        const existing = await this.profileRepo.findOne({ where: { userId, isDefault: true } });
        if (existing) return existing;
        try {
            return await this.profileRepo.save(this.profileRepo.create({ userId, name: 'الحساب الافتراضي', isDefault: true }));
        } catch {
            // طلبان متزامنان: الفهرس الفريد يمنع حساباً افتراضياً ثانياً
            return this.profileRepo.findOneOrFail({ where: { userId, isDefault: true } });
        }
    }

    // الحساب المطلوب (يجب أن يملكه التاجر) أو الافتراضي إن لم يُحدَّد
    async resolveProfile(userId: string, profileId?: string): Promise<ShippingProfile> {
        if (!profileId) return this.getDefaultProfile(userId);
        const profile = await this.profileRepo.findOne({ where: { id: profileId, userId } });
        if (!profile) throw new NotFoundException('حساب الشحن غير موجود');
        return profile;
    }

    async listProfiles(userId: string) {
        const defaultId = (await this.getDefaultProfile(userId)).id;
        const profiles = await this.profileRepo.find({ where: { userId }, order: { isDefault: 'DESC', createdAt: 'ASC' } });
        const stores = await this.storeRepo.find({ where: { user: { id: userId } }, select: ['id', 'name', 'shippingProfileId'] });
        const counts = await this.shippingRepo
            .createQueryBuilder('s')
            .select('s.profileId', 'profileId')
            .addSelect('COUNT(*) FILTER (WHERE s.isActive)', 'active')
            .where('s.userId = :userId', { userId })
            .groupBy('s.profileId')
            .getRawMany();
        const activeBy = new Map(counts.map((c) => [c.profileId, Number(c.active)]));
        return profiles.map((p) => ({
            id: p.id,
            name: p.name,
            isDefault: p.isDefault,
            activeWilayas: activeBy.get(p.id) ?? 0,
            // المتاجر التي تستعمل هذا الحساب (بدون اختيار = الافتراضي)
            stores: stores
                .filter((st) => (st.shippingProfileId ?? defaultId) === p.id)
                .map((st) => ({ id: st.id, name: st.name })),
        }));
    }

    // حساب جديد يبدأ بنسخة من أسعار حساب موجود (الافتراضي إن لم يُحدَّد) ليعدّلها التاجر بعد ذلك
    async createProfile(userId: string, name: string, copyFromId?: string) {
        const trimmed = name?.trim();
        if (!trimmed) throw new BadRequestException('اسم الحساب مطلوب');
        const source = await this.resolveProfile(userId, copyFromId);
        const profile = await this.profileRepo.save(this.profileRepo.create({ userId, name: trimmed, isDefault: false }));
        const rates = await this.shippingRepo.find({ where: { profileId: source.id } });
        if (rates.length) {
            await this.shippingRepo.insert(rates.map((r) => ({
                userId, profileId: profile.id, wilayaId: r.wilayaId, isActive: r.isActive,
                priceHome: r.priceHome, priceOffice: r.priceOffice, priceReturn: r.priceReturn,
            })));
        } else {
            await this.createShipping(userId, [], profile.id);
        }
        return profile;
    }

    async renameProfile(userId: string, profileId: string, name: string) {
        const profile = await this.resolveProfile(userId, profileId);
        const trimmed = name?.trim();
        if (!trimmed) throw new BadRequestException('اسم الحساب مطلوب');
        profile.name = trimmed;
        return this.profileRepo.save(profile);
    }

    // المتاجر التي تستعمل الحساب المحذوف ترجع تلقائياً للحساب الافتراضي (ON DELETE SET NULL)
    async deleteProfile(userId: string, profileId: string) {
        const profile = await this.resolveProfile(userId, profileId);
        if (profile.isDefault) throw new BadRequestException('لا يمكن حذف الحساب الافتراضي');
        await this.profileRepo.delete({ id: profile.id });
        return { message: 'تم حذف حساب الشحن' };
    }

    // اختيار حساب الشحن لمتجر (null أو الحساب الافتراضي = الرجوع للافتراضي)
    async setStoreProfile(userId: string, storeId: string, profileId?: string | null) {
        const store = await this.storeRepo.findOne({ where: { id: storeId, user: { id: userId } } });
        if (!store) throw new NotFoundException('المتجر غير موجود');
        const profile = profileId ? await this.resolveProfile(userId, profileId) : null;
        await this.storeRepo.update(store.id, { shippingProfileId: profile && !profile.isDefault ? profile.id : null });
        return { storeId: store.id, shippingProfileId: profile && !profile.isDefault ? profile.id : null };
    }

    /* أسعار الشحن (داخل حساب) */

    async createShipping(userId: string, jsonWilayas: JsonWilayaDto[] = [], profileId?: string) {
        const profile = await this.resolveProfile(userId, profileId);
        let shippingData: any[];

        if (jsonWilayas.length === 0) {
            const wilayas = await this.wilayaRepo.find({ order: { id: 'ASC' } });
            shippingData = wilayas.map((wilaya) => ({
                userId, profileId: profile.id, wilayaId: wilaya.id,
                priceHome: 0, priceOffice: 0, priceReturn: 0,
            }));
        } else {
            shippingData = jsonWilayas.map((wilaya) => ({
                userId, profileId: profile.id, wilayaId: wilaya.wilayaId,
                priceHome: wilaya.priceHome, priceOffice: wilaya.priceOffice, priceReturn: wilaya.priceReturn,
            }));
        }

        try {
            // تحديث السطر إن وُجد في نفس الحساب، أو إنشاؤه
            await this.shippingRepo.upsert(shippingData, ['profileId', 'wilayaId']);
            return this.getShipping(userId, profile.id);
        } catch (error) {
            throw new Error(`Failed to initialize shipping: ${error.message}`);
        }
    }

    private toPublicRows(rows: Shipping[]) {
        return rows.map(w => ({
            id: w.wilaya.id,
            ar_name: w.wilaya.ar_name,
            name: w.wilaya.name,
            livraisonHome: w.priceHome,
            livraisonOfice: w.priceOffice,
            livraisonReturn: w.priceReturn,
            isActive: w.isActive,
        }));
    }

    async getShipping(userId: string, profileId?: string) {
        const profile = await this.resolveProfile(userId, profileId);
        const rows = await this.shippingRepo.find({
            where: { profileId: profile.id },
            relations: ['wilaya'],
            order: { wilayaId: 'ASC' },
        });
        return this.toPublicRows(rows);
    }

    // الحساب الذي يستعمله المتجر، أو الافتراضي للتاجر
    async profileIdForStore(userId: string, storeId?: string): Promise<string> {
        if (storeId) {
            const store = await this.storeRepo.findOne({ where: { id: storeId, user: { id: userId } }, select: ['id', 'shippingProfileId'] });
            if (store?.shippingProfileId) return store.shippingProfileId;
        }
        return (await this.getDefaultProfile(userId)).id;
    }

    async getShippingPublic(userId: string, storeId?: string) {
        const profileId = await this.profileIdForStore(userId, storeId);
        const rows = await this.shippingRepo.find({
            where: { profileId, isActive: true },
            relations: ['wilaya'],
            order: { wilayaId: 'ASC' },
        });
        return this.toPublicRows(rows);
    }

    async updateShippingPrices(userId: string, updates: { wilayaId: number, priceHome?: number, priceOffice?: number, priceReturn?: number, isActive?: boolean }[], profileId?: string) {
        const profile = await this.resolveProfile(userId, profileId);
        const updatePromises = updates.map(async (update) => {
            // تحديث الحقول المرسلة فقط
            const updateFields: any = {};
            if (update.priceHome != null) updateFields.priceHome = update.priceHome;
            if (update.priceOffice != null) updateFields.priceOffice = update.priceOffice;
            if (update.priceReturn != null) updateFields.priceReturn = update.priceReturn;
            if (update.isActive != null) updateFields.isActive = update.isActive;
            if (Object.keys(updateFields).length === 0) return null;
            return this.shippingRepo.update({ profileId: profile.id, wilayaId: update.wilayaId }, updateFields);
        });

        await Promise.all(updatePromises);
        return { message: "تم تحديث الحقول المرسلة فقط، والباقي بقي كما هو." };
    }

    async deleteShippingPrices(userId: string, wilayaIds: number[], profileId?: string) {
        const profile = await this.resolveProfile(userId, profileId);
        await this.shippingRepo.delete({ profileId: profile.id, wilayaId: In(wilayaIds) });
        return { message: "تم حذف الولايات المحددة." };
    }

    // يضيف فقط الولايات التي لا تملك سطر أسعار في هذا الحساب بعد (بعد حذفها مثلاً)،
    // بعملية insert صرفة بدون لمس أسعار الولايات الموجودة أصلاً.
    // إذا مُرِّر wilayaIds، تُقتصر الإضافة على تقاطعها مع الولايات الناقصة فعلاً
    async addMissingWilayas(userId: string, wilayaIds?: number[], profileId?: string) {
        const profile = await this.resolveProfile(userId, profileId);
        const [allWilayas, existingRows] = await Promise.all([
            this.wilayaRepo.find({ order: { id: 'ASC' } }),
            this.shippingRepo.find({ where: { profileId: profile.id }, select: ['wilayaId'] }),
        ]);

        const existingIds = new Set(existingRows.map((row) => row.wilayaId));
        let missingWilayas = allWilayas.filter((wilaya) => !existingIds.has(wilaya.id));

        if (wilayaIds && wilayaIds.length > 0) {
            const requestedIds = new Set(wilayaIds);
            missingWilayas = missingWilayas.filter((wilaya) => requestedIds.has(wilaya.id));
        }

        if (missingWilayas.length > 0) {
            const newRows = missingWilayas.map((wilaya) => this.shippingRepo.create({
                userId, profileId: profile.id, wilayaId: wilaya.id,
                priceHome: 0, priceOffice: 0, priceReturn: 0,
            }));
            await this.shippingRepo.insert(newRows);
        }

        return { added: missingWilayas.length, wilayas: await this.getShipping(userId, profile.id) };
    }

}
