import { PartialType } from '@nestjs/mapped-types';
import { CreatePlanDto } from './create-plan.dto';

export class UpdatePlanDto extends PartialType(CreatePlanDto) {}
// سيجعل هذا الكلاس كل حقول CreatePlanDto اختيارية عند التحديث