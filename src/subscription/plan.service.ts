import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plan } from './entities/plan.entity';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';

@Injectable()
export class PlansService {
  constructor(
    @InjectRepository(Plan)
    private readonly planRepository: Repository<Plan>,
  ) {}

  /**
   * إنشاء خطة جديدة
   */
  async create(createPlanDto: CreatePlanDto): Promise<Plan> {
    // يمكنك إضافة منطق للتحقق من عدم تكرار اسم الخطة إذا أردت
    const newPlan = this.planRepository.create(createPlanDto);
    return await this.planRepository.save(newPlan);
  }

  /**
   * جلب جميع الخطط (يمكن إضافة تصفية للخطط النشطة فقط)
   */
  async findAll(onlyActive: boolean = false): Promise<Plan[]> {
    const query = onlyActive ? { where: { isActive: true } } : {};
    return await this.planRepository.find(query);
  }

  /**
   * جلب خطة واحدة عن طريق الـ ID (UUID)
   */
  async findOne(id: string): Promise<Plan> {
    const plan = await this.planRepository.findOne({ where: { id } });
    if (!plan) {
      throw new NotFoundException(`Plan with ID "${id}" not found`);
    }
    return plan;
  }

  /**
   * تحديث بيانات خطة
   */
  async update(id: string, updatePlanDto: UpdatePlanDto): Promise<Plan> {
    const plan = await this.findOne(id); // التأكد من وجودها أولاً
    
    // دمج التحديثات مع الكيان الحالي
    const updatedPlan = this.planRepository.merge(plan, updatePlanDto);
    return await this.planRepository.save(updatedPlan);
  }

  /**
   * حذف خطة نهائياً (أو يمكنك عمل Soft Delete)
   */
  async remove(id: string): Promise<void> {
    const result = await this.planRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Plan with ID "${id}" not found`);
    }
  }

  /**
   * تفعيل أو تعطيل خطة بسرعة
   */
  async toggleStatus(id: string): Promise<Plan> {
    const plan = await this.findOne(id);
    plan.isActive = !plan.isActive;
    return await this.planRepository.save(plan);
  }
}