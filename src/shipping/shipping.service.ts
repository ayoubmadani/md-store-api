import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { WilayaDto } from "./dto/wilaya.dto";
import { InjectRepository } from "@nestjs/typeorm";
import { Wilaya } from "./entity/wilaya.entity";
import { Repository, In } from "typeorm";
import { ShippingCommuneRule } from "./entity/shipping-commune-rule.entity";
import { fetchCountries } from "./countries.util";
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
        @InjectRepository(ShippingCommuneRule) private readonly communeRuleRepo: Repository<ShippingCommuneRule>,
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

    // ولايات دولة واحدة (الجزائر افتراضياً — كل الواجهات الحالية جزائرية)
    async getAllWilayas(country = 'DZ') {
        return this.wilayaRepo.find({ where: { country: country.toUpperCase() }, order: { id: "ASC" } })
    }

    private async inactiveCountries(): Promise<Set<string>> {
        return new Set((await fetchCountries()).filter((c) => c.active === false).map((c) => c.code));
    }

    // الدول التي يمكن تسعير التوصيل فيها: لها مناطق في جدول wilayas وغير معطّلة من الأدمن.
    // الجزائر تبقى دائماً (كل المتاجر الحالية جزائرية).
    async shippingCountries(): Promise<string[]> {
        const rows: { country: string }[] = await this.wilayaRepo.createQueryBuilder('w').select('DISTINCT w.country', 'country').getRawMany();
        const inactive = await this.inactiveCountries();
        return rows.map((r) => r.country)
            .filter((c) => c === 'DZ' || !inactive.has(c))
            .sort((a, b) => (a === 'DZ' ? -1 : b === 'DZ' ? 1 : a.localeCompare(b)));
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
        const stores = await this.storeRepo.find({ where: { user: { id: userId } }, select: ['id', 'name', 'shippingProfileId', 'country'] });
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
            country: p.country || 'DZ',
            activeWilayas: activeBy.get(p.id) ?? 0,
            // المتاجر التي تستعمل هذا الحساب (بدون اختيار = الافتراضي)
            stores: stores
                .filter((st) => (st.shippingProfileId ?? defaultId) === p.id)
                .map((st) => ({ id: st.id, name: st.name, country: st.country || 'DZ' })),
        }));
    }

    // حساب جديد يبدأ بنسخة من أسعار حساب موجود (الافتراضي إن لم يُحدَّد) ليعدّلها التاجر بعد ذلك
    // حد حسابات الشحن حسب خطة التاجر (شاملاً الحساب الافتراضي)
    async profileLimit(userId: string): Promise<{ used: number; limit: number }> {
        const [plan] = await this.profileRepo.manager.query(
            `SELECT f."shippingProfileNumber" AS "limit"
               FROM subscriptions s
               JOIN plans p ON p.id = s."planId"
               JOIN plan_features f ON f.id = p."featuresId"
              WHERE s."userId"::text = $1 AND s.status = 'active' AND s."endDate" > now()
              ORDER BY s."startDate" DESC
              LIMIT 1`,
            [userId],
        ).catch(() => []);
        const used = await this.profileRepo.count({ where: { userId } });
        return { used, limit: plan ? Number(plan.limit) || 1 : 1 };
    }

    private async assertProfileLimit(userId: string) {
        const { used, limit } = await this.profileLimit(userId);
        if (used >= limit) throw new BadRequestException(`وصلت إلى حد خطتك: ${limit} حسابات شحن — رقِّ خطتك لإضافة المزيد`);
    }

    async createProfile(userId: string, name: string, copyFromId?: string, country = 'DZ') {
        const trimmed = name?.trim();
        if (!trimmed) throw new BadRequestException('اسم الحساب مطلوب');
        await this.assertProfileLimit(userId);
        const cc = (country || 'DZ').toUpperCase();
        if (!(await this.shippingCountries()).includes(cc)) throw new BadRequestException(`التوصيل في الدولة ${cc} غير مدعوم بعد`);
        const source = await this.resolveProfile(userId, copyFromId);
        const profile = await this.profileRepo.save(this.profileRepo.create({ userId, name: trimmed, isDefault: false, country: cc }));
        // النسخ فقط من حساب بنفس الدولة، وإلا يبدأ الحساب فارغاً بمناطق دولته
        const sameCountry = (source.country || 'DZ') === cc;
        const rates = sameCountry ? await this.shippingRepo.find({ where: { profileId: source.id } }) : [];
        if (rates.length) {
            await this.shippingRepo.insert(rates.map((r) => ({
                userId, profileId: profile.id, wilayaId: r.wilayaId, isActive: r.isActive,
                homeEnabled: r.homeEnabled, officeEnabled: r.officeEnabled,
                priceHome: r.priceHome, priceOffice: r.priceOffice, priceReturn: r.priceReturn,
            })));
        } else {
            await this.createShipping(userId, [], profile.id);
        }
        // نسخ البلديات المعطّلة/المقيّدة أيضاً
        const rules = sameCountry ? await this.communeRuleRepo.find({ where: { profileId: source.id } }).catch(() => [] as ShippingCommuneRule[]) : [];
        if (rules.length) {
            await this.communeRuleRepo.insert(rules.map((r) => ({
                profileId: profile.id, communeId: r.communeId, wilayaId: r.wilayaId, homeEnabled: r.homeEnabled, officeEnabled: r.officeEnabled,
            })));
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
        const profile = profileId ? await this.resolveProfile(userId, profileId) : await this.getDefaultProfile(userId);
        // حساب الشحن يجب أن يكون من دولة المتجر (حساب تونسي لمتجر تونسي فقط)
        const storeCountry = store.country || 'DZ';
        if ((profile.country || 'DZ') !== storeCountry) {
            throw new BadRequestException(`هذا الحساب لدولة ${profile.country || 'DZ'} والمتجر لدولة ${storeCountry} — اختر حساب شحن من نفس الدولة`);
        }
        await this.storeRepo.update(store.id, { shippingProfileId: profile && !profile.isDefault ? profile.id : null });
        return { storeId: store.id, shippingProfileId: profile && !profile.isDefault ? profile.id : null };
    }

    /* أسعار الشحن (داخل حساب) */

    async createShipping(userId: string, jsonWilayas: JsonWilayaDto[] = [], profileId?: string) {
        const profile = await this.resolveProfile(userId, profileId);
        let shippingData: any[];

        if (jsonWilayas.length === 0) {
            const wilayas = await this.wilayaRepo.find({ where: { country: profile.country || 'DZ' }, order: { id: 'ASC' } });
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
            country: w.wilaya.country || 'DZ',
            ar_name: w.wilaya.ar_name,
            name: w.wilaya.name,
            livraisonHome: w.priceHome,
            livraisonOfice: w.priceOffice,
            livraisonReturn: w.priceReturn,
            isActive: w.isActive,
            homeEnabled: w.homeEnabled !== false,
            officeEnabled: w.officeEnabled !== false,
        }));
    }

    async getShipping(userId: string, profileId?: string) {
        const profile = await this.resolveProfile(userId, profileId);
        const rows = await this.shippingRepo.find({
            where: { profileId: profile.id },
            relations: ['wilaya'],
            order: { wilayaId: 'ASC' },
        });
        // عدد البلديات المقيّدة في كل ولاية (لعرضه في صفحة الأسعار)
        const counts: { wilayaId: number; n: string }[] = await this.communeRuleRepo.createQueryBuilder('r')
            .select('r.wilayaId', 'wilayaId').addSelect('COUNT(*)', 'n')
            .where('r.profileId = :pid', { pid: profile.id }).groupBy('r.wilayaId').getRawMany()
            .catch(() => []); // قبل تشغيل migration الجدول غير موجود — لا نكسر صفحة الأسعار
        const byWilaya = new Map(counts.map((c) => [Number(c.wilayaId), Number(c.n)]));
        return this.toPublicRows(rows).map((r) => ({ ...r, restrictedCommunes: byWilaya.get(r.id) ?? 0 }));
    }

    /* استثناءات البلديات (تعطيل بلدية كلياً أو للمنزل/المكتب فقط) */

    // بلديات ولاية مع حالة كل منها في حساب الشحن (للوحة التاجر)
    async getCommuneRules(userId: string, wilayaId: number, profileId?: string) {
        const profile = await this.resolveProfile(userId, profileId);
        const [communes, rules] = await Promise.all([
            this.communesRepo.find({ where: { wilayaId }, order: { id: 'ASC' } }),
            this.communeRuleRepo.find({ where: { profileId: profile.id, wilayaId } }).catch(() => [] as ShippingCommuneRule[]),
        ]);
        const byId = new Map(rules.map((r) => [r.communeId, r]));
        return communes.map((c) => {
            const r = byId.get(c.id);
            return { id: c.id, name: c.name, ar_name: c.ar_name, post_code: c.post_code, homeEnabled: r ? r.homeEnabled : true, officeEnabled: r ? r.officeEnabled : true };
        });
    }

    // يحفظ حالة بلديات ولاية: المفعّلة للنوعين تُحذف من الجدول (تتبع الولاية)، والباقي يُحفظ كاستثناء
    async setCommuneRules(userId: string, wilayaId: number, items: { communeId: number; homeEnabled: boolean; officeEnabled: boolean }[], profileId?: string) {
        const profile = await this.resolveProfile(userId, profileId);
        const valid = new Set((await this.communesRepo.find({ where: { wilayaId }, select: ['id'] })).map((c) => c.id));
        const bad = items.filter((i) => !valid.has(i.communeId)).map((i) => i.communeId);
        if (bad.length) throw new BadRequestException(`بلديات لا تنتمي لهذه الولاية: ${bad.slice(0, 10).join(', ')}`);
        const enable = items.filter((i) => i.homeEnabled && i.officeEnabled).map((i) => i.communeId);
        const restrict = items.filter((i) => !(i.homeEnabled && i.officeEnabled));
        if (enable.length) await this.communeRuleRepo.delete({ profileId: profile.id, communeId: In(enable) });
        if (restrict.length) {
            await this.communeRuleRepo.upsert(
                restrict.map((i) => ({ profileId: profile.id, communeId: i.communeId, wilayaId, homeEnabled: !!i.homeEnabled, officeEnabled: !!i.officeEnabled })),
                ['profileId', 'communeId'],
            );
        }
        return { profileId: profile.id, wilayaId, restricted: await this.communeRuleRepo.count({ where: { profileId: profile.id, wilayaId } }) };
    }

    // حساب الشحن الفعلي لمتجر (من المتجر وحده — للواجهات العامة والتحقق من الطلب)
    async profileIdForStoreId(storeId: string): Promise<string | undefined> {
        const store = await this.storeRepo.findOne({ where: { id: storeId }, relations: ['user'], select: { id: true, shippingProfileId: true, user: { id: true } } as any });
        if (!store) return undefined;
        if (store.shippingProfileId) return store.shippingProfileId;
        return (await this.profileRepo.findOne({ where: { userId: (store as any).user?.id, isDefault: true } }))?.id;
    }

    // المتجر من نطاق الطلب (Origin/Referer) — كل الثيمات تجلب البلديات من المتصفح على دومين المتجر
    private storeByHost = new Map<string, { id: string | null; at: number }>();
    async storeIdForHost(host?: string): Promise<string | undefined> {
        const h = (host || '').toLowerCase().replace(/^www\./, '');
        if (!h || h === 'localhost') return undefined;
        const hit = this.storeByHost.get(h);
        if (hit && Date.now() - hit.at < 60_000) return hit.id ?? undefined;
        const [row] = await this.storeRepo.manager.query(
            `SELECT "storeId" FROM domains WHERE lower(domain) = $1 AND "deletedAt" IS NULL LIMIT 1`, [h],
        ).catch(() => []);
        this.storeByHost.set(h, { id: row?.storeId ?? null, at: Date.now() });
        return row?.storeId;
    }

    // للمتجر: بلديات الولاية بدون المعطّلة كلياً، مع أنواع التوصيل المتاحة في كل بلدية
    async getCommunesForStore(wilayaId: number, storeId?: string) {
        const communes = await this.communesRepo.find({ where: { wilayaId } });
        if (!storeId) return communes;
        const profileId = await this.profileIdForStoreId(storeId).catch(() => undefined);
        if (!profileId) return communes;
        const rules = await this.communeRuleRepo.find({ where: { profileId, wilayaId } }).catch(() => [] as ShippingCommuneRule[]);
        if (!rules.length) return communes;
        const byId = new Map(rules.map((r) => [r.communeId, r]));
        return communes
            .filter((c) => { const r = byId.get(c.id); return !r || r.homeEnabled || r.officeEnabled; })
            .map((c) => { const r = byId.get(c.id); return r ? { ...c, homeEnabled: r.homeEnabled, officeEnabled: r.officeEnabled } : c; });
    }

    // للتحقق عند الطلب: null = لا قيود على هذه البلدية
    async communeRule(storeId: string, communeId: number) {
        const profileId = await this.profileIdForStoreId(storeId);
        if (!profileId) return null;
        return this.communeRuleRepo.findOne({ where: { profileId, communeId } });
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

    async updateShippingPrices(userId: string, updates: { wilayaId: number, priceHome?: number, priceOffice?: number, priceReturn?: number, isActive?: boolean, homeEnabled?: boolean, officeEnabled?: boolean }[], profileId?: string) {
        const profile = await this.resolveProfile(userId, profileId);
        const updatePromises = updates.map(async (update) => {
            // تحديث الحقول المرسلة فقط
            const updateFields: any = {};
            if (update.priceHome != null) updateFields.priceHome = update.priceHome;
            if (update.priceOffice != null) updateFields.priceOffice = update.priceOffice;
            if (update.priceReturn != null) updateFields.priceReturn = update.priceReturn;
            if (update.isActive != null) updateFields.isActive = update.isActive;
            if (update.homeEnabled != null) updateFields.homeEnabled = !!update.homeEnabled;
            if (update.officeEnabled != null) updateFields.officeEnabled = !!update.officeEnabled;
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
            this.wilayaRepo.find({ where: { country: profile.country || 'DZ' }, order: { id: 'ASC' } }),
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
