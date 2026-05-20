import { IsString, IsOptional, IsUUID, IsInt, Min, IsBoolean, MaxLength, ValidateIf } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @MaxLength(100, { message: 'اسم التصنيف يجب أن يكون أقل من 100 حرف' })
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'الوصف يجب أن يكون أقل من 500 حرف' })
  description?: string;

  @IsOptional()
  @IsString({ message: 'رابط الصورة غير صالح' })
  imageUrl?: string;

  // 👈 الحل هنا: نطلب من الفلتر عدم الفحص إذا كانت القيمة خالية أو null
  @IsOptional()
  @ValidateIf((object, value) => value !== null && value !== '')
  @IsUUID('4', { message: 'معرّف التصنيف الأب غير صالح' })
  parentId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  slug?: string;

  // 👈 نفس الفكرة للـ Niche لكي لا يسبب مشكلة مشابهة مستقبلاً
  @IsOptional()
  @ValidateIf((object, value) => value !== null && value !== '')
  @IsUUID('4', { message: 'معرّف الـ Niche غير صالح' })
  categoryNicheId?: string | null;
}