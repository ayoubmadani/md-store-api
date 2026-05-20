import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Niche } from './entities/niche.entity';
import { CreateNicheDto } from './dto/create-niche.dto';
import { UpdateNicheDto } from './dto/update-niche.dto';
import { CategoryNiche } from './entities/category-niche.entity';
import { Store } from '../store/entities/store.entity';

@Injectable()
export class NicheService {
    // 1️⃣ كاش القائمة الكاملة لجميع الـ niches
    private globalCache: Niche[] | null = null;

    // 2️⃣ كاش مخصص لكل متجر بناءً على الـ storeId
    private storeCache = new Map<string, Niche[]>();

    constructor(
        @InjectRepository(Niche) private readonly nicheRepository: Repository<Niche>,
        @InjectRepository(CategoryNiche) private readonly catNicheRepository: Repository<CategoryNiche>,
        @InjectRepository(Store) private readonly StoreRepository: Repository<Store>,
    ) { }

    async create(createNicheDto: CreateNicheDto[]): Promise<Niche[]> {
        this.invalidateCache(); // تفريغ الكاش بالكامل لضمان تحديث البيانات
        const niche = this.nicheRepository.create(createNicheDto);
        return this.nicheRepository.save(niche);
    }

    async findAll(): Promise<Niche[]> {
        if (this.globalCache) return this.globalCache;
        this.globalCache = await this.nicheRepository.find();
        return this.globalCache;
    }

    async categoriesNiche(storeId: string): Promise<CategoryNiche[]> { // 👈 تم تعديل نوع الإرجاع ليتوافق مع الـ Repository

        // 1️⃣ خطوة مهمة: إضافة relations لجلب علاقة الـ niche مع المتجر
        const store = await this.StoreRepository.findOne({
            where: { id: storeId },
            relations: ['niche']
        });

        // 2️⃣ التحقق من وجود المتجر والـ niche الخاص به
        if (store?.niche?.id) {
            return this.catNicheRepository.find({
                where: { nicheId: store.niche.id }
            });
        }

        // 3️⃣ الفولباك (Fallback): إذا لم يجد المتجر أو النيتش، يعيد كل التصنيفات
        return this.catNicheRepository.find();
    }

    async findOne(id: string): Promise<Niche> {
        const niche = await this.nicheRepository.findOne({ where: { id } });
        if (!niche) throw new NotFoundException(`Niche with id ${id} not found`);
        return niche;
    }

    async update(id: string, updateNicheDto: UpdateNicheDto): Promise<Niche> {
        const niche = await this.findOne(id);
        Object.assign(niche, updateNicheDto);
        this.invalidateCache(); // تفريغ الكاش عند التعديل
        return this.nicheRepository.save(niche);
    }

    async remove(id: string): Promise<void> {
        const niche = await this.findOne(id);
        this.invalidateCache(); // تفريغ الكاش عند الحذف
        await this.nicheRepository.remove(niche);
    }

    /**
     * 🔄 دالة مساعدة لتفريغ جميع أنواع التخزين المؤقت
     * لضمان عدم قراءة بيانات قديمة بعد أي عملية تعديل أو حذف
     */
    private invalidateCache(): void {
        this.globalCache = null;
        this.storeCache.clear();
    }
}