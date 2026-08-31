import { Injectable } from "@nestjs/common";
import { WilayaDto } from "./dto/wilaya.dto";
import { InjectRepository } from "@nestjs/typeorm";
import { Wilaya } from "./entity/wilaya.entity";
import { Repository, In } from "typeorm";
import { Commune } from "./entity/commune.entity";
import { CommuneDto } from "./dto/commune.dto";
import { Shipping } from "./entity/shipping.entity";
import { JsonWilayaDto } from "./dto/jsonWilaya.dto";

@Injectable()
export class ShippingService {
    constructor(
        @InjectRepository(Wilaya) private readonly wilayaRepo: Repository<Wilaya>,
        @InjectRepository(Commune) private readonly communesRepo: Repository<Commune>,
        @InjectRepository(Shipping) private readonly shippingRepo: Repository<Shipping>
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

    async createShipping(userId: string, jsonWilayas: JsonWilayaDto[] = []) {
        let shippingData: any[];

        // 1. تحديد البيانات بناءً على ما إذا كانت المصفوفة فارغة أم لا
        if (jsonWilayas.length === 0) {
            const wilayas = await this.wilayaRepo.find({ order: { id: 'ASC' } });

            shippingData = wilayas.map((wilaya) => ({
                userId: userId, // تأكد أن هذا هو اسم العمود الفعلي في جدول الـ Shipping
                wilayaId: wilaya.id,
                priceHome: 0,
                priceOffice: 0,
                priceReturn: 0,
            }));
        } else {
            shippingData = jsonWilayas.map((wilaya) => ({
                userId: userId,
                wilayaId: wilaya.wilayaId,
                priceHome: wilaya.priceHome,
                priceOffice: wilaya.priceOffice,
                priceReturn: wilaya.priceReturn,
            }));
        }

        try {
            // 2. استخدام مصفوفة بسيطة للأعمدة المتعارضة (Conflict Columns)
            // هذا سيقوم بالتحديث (Update) إذا وجد السجل، أو الإنشاء (Insert) إذا لم يجده
            await this.shippingRepo.upsert(
                shippingData,
                ['userId', 'wilayaId'] // تأكد أن هذين العمودين يشكلان Unique Constraint في الـ Entity
            );

            // 3. جلب البيانات النهائية مع العلاقات لعرض الأسماء والأكواد في الـ Frontend
            return this.getShipping(userId)

        } catch (error) {
            // إذا استمر الخطأ، فغالباً Unique Constraint غير معرف في الـ Entity
            throw new Error(`Failed to initialize shipping: ${error.message}`);
        }
    }

    

    async getShipping(userId: string) {
        const wilayas = await this.shippingRepo.find({
            where: { user: { id: userId } },
            relations: ['wilaya'], // لجلب بيانات الولاية (الاسم، ar_name) مع السعر
            order: {
                wilayaId: 'ASC'   // لترتيب الولايات من 1 إلى 69 بشكل منظم
            }
        });

        const newLisWilayas = wilayas.map(w => {
            return {
                id: w.wilaya.id,
                ar_name: w.wilaya.ar_name,
                name: w.wilaya.name,
                livraisonHome: w.priceHome,
                livraisonOfice: w.priceOffice,
                livraisonReturn: w.priceReturn,
                isActive: w.isActive,
            }
        })

        return newLisWilayas
    }

    async getShippingPublic(userId: string) {
        const wilayas = await this.shippingRepo.find({
            where: { user: { id: userId }, isActive:true },
            relations: ['wilaya'], // لجلب بيانات الولاية (الاسم، ar_name) مع السعر
            order: {
                wilayaId: 'ASC'   // لترتيب الولايات من 1 إلى 69 بشكل منظم
            }
        });

        const newLisWilayas = wilayas.map(w => {
            return {
                id: w.wilaya.id,
                ar_name: w.wilaya.ar_name,
                name: w.wilaya.name,
                livraisonHome: w.priceHome,
                livraisonOfice: w.priceOffice,
                livraisonReturn: w.priceReturn,
                isActive: w.isActive,
            }
        })

        return newLisWilayas
    }


    async updateShippingPrices(userId: string, updates: { wilayaId: number, priceHome?: number, priceOffice?: number, priceReturn?: number,isActive?:boolean }[]) {
        const updatePromises = updates.map(async (update) => {
            // 1. بناء كائن التحديث للحقول الموجودة فقط
            const updateFields: any = {};

            if (update.priceHome != null) updateFields.priceHome = update.priceHome;
            if (update.priceOffice != null) updateFields.priceOffice = update.priceOffice;
            if (update.priceReturn != null) updateFields.priceReturn = update.priceReturn;
            if (update.isActive != null) updateFields.isActive = update.isActive;

            // 2. إذا لم يكن هناك أي حقل للتحديث، نتخطى هذه الولاية
            if (Object.keys(updateFields).length === 0) return null;

            // 3. التحديث فقط للحقول التي أرسلها المستخدم (لن يلمس الباقي)
            return this.shippingRepo.update(
                { userId: userId, wilayaId: update.wilayaId },
                updateFields
            );
        });

        await Promise.all(updatePromises);
        return { message: "تم تحديث الحقول المرسلة فقط، والباقي بقي كما هو." };
    }

    async deleteShippingPrices(userId: string, wilayaIds: number[]) {
        await this.shippingRepo.delete({ userId, wilayaId: In(wilayaIds) });
        return { message: "تم حذف الولايات المحددة." };
    }

    // يضيف فقط الولايات التي لا تملك سطر أسعار لهذا المستخدم بعد (بعد حذفها مثلاً)،
    // بعملية insert صرفة بدون لمس أسعار الولايات الموجودة أصلاً.
    // إذا مُرِّر wilayaIds، تُقتصر الإضافة على تقاطعها مع الولايات الناقصة فعلاً
    // (نعيد التحقق من طرف السيرفر بدل الوثوق بما اختاره العميل في نافذة الاختيار)
    async addMissingWilayas(userId: string, wilayaIds?: number[]) {
        const [allWilayas, existingRows] = await Promise.all([
            this.wilayaRepo.find({ order: { id: 'ASC' } }),
            this.shippingRepo.find({ where: { userId }, select: ['wilayaId'] }),
        ]);

        const existingIds = new Set(existingRows.map((row) => row.wilayaId));
        let missingWilayas = allWilayas.filter((wilaya) => !existingIds.has(wilaya.id));

        if (wilayaIds && wilayaIds.length > 0) {
            const requestedIds = new Set(wilayaIds);
            missingWilayas = missingWilayas.filter((wilaya) => requestedIds.has(wilaya.id));
        }

        if (missingWilayas.length > 0) {
            const newRows = missingWilayas.map((wilaya) => this.shippingRepo.create({
                userId,
                wilayaId: wilaya.id,
                priceHome: 0,
                priceOffice: 0,
                priceReturn: 0,
            }));
            await this.shippingRepo.insert(newRows);
        }

        return { added: missingWilayas.length, wilayas: await this.getShipping(userId) };
    }

}