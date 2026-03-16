import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plan } from './entities/plan.entity';
import { Subscription } from '../subscription/entities/subscription.entity';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@Injectable()
export class PlansService {
    constructor(
        @InjectRepository(Plan)
        private readonly planRepository: Repository<Plan>,
        @InjectRepository(Subscription)
        private readonly subRepository: Repository<Subscription>,
    ) { }

    async create(createPlanDto: CreatePlanDto): Promise<Plan> {
        // منع تكرار الاسم
        const existing = await this.planRepository.findOne({
            where: { name: createPlanDto.name },
        });
        if (existing) {
            throw new ConflictException(`خطة بالاسم "${createPlanDto.name}" موجودة مسبقاً`);
        }

        const newPlan = this.planRepository.create(createPlanDto);
        return await this.planRepository.save(newPlan);
    }

    async findAll(onlyActive = false): Promise<Plan[]> {
        return await this.planRepository.find({
            where: onlyActive ? { isActive: true } : {},
            relations: ['features'], // ← جلب الـ features مع كل Plan
            order: { createdAt: 'DESC' },
        });
    }

    async findOne(id: string): Promise<Plan> {
        const plan = await this.planRepository.findOne({
            where: { id },
            relations: ['features'], // ← ضروري لأن Plan لا معنى له بدون features
        });
        if (!plan) throw new NotFoundException(`الخطة بالمعرف "${id}" غير موجودة`);
        return plan;
    }

    async update(id: string, updatePlanDto: UpdatePlanDto): Promise<Plan> {
        const plan = await this.findOne(id); // يجلب features أيضاً بسبب relations

        const { features, ...planFields } = updatePlanDto;

        // تحديث حقول الـ Plan العادية
        this.planRepository.merge(plan, planFields);

        // تحديث الـ FeaturesEntity بشكل منفصل إذا أُرسلت
        if (features && plan.features) {
            Object.assign(plan.features, features);
        }

        return await this.planRepository.save(plan); // cascade:true يحفظ features تلقائياً
    }

    async remove(id: string): Promise<void> {
        // منع حذف خطة عليها اشتراكات نشطة
        const activeSubs = await this.subRepository
            .createQueryBuilder('sub')
            .where('sub.planId = :id', { id })
            .andWhere('sub.status = :status', { status: 'active' })
            .getCount();

        if (activeSubs > 0) {
            throw new ConflictException(
                `لا يمكن حذف هذه الخطة — يوجد ${activeSubs} اشتراك نشط مرتبط بها`,
            );
        }

        const result = await this.planRepository.delete(id);
        if (result.affected === 0) {
            throw new NotFoundException(`الخطة بالمعرف "${id}" غير موجودة`);
        }
    }

    async toggleStatus(id: string): Promise<Plan> {
        const plan = await this.findOne(id);
        plan.isActive = !plan.isActive;
        return await this.planRepository.save(plan);
    }
}