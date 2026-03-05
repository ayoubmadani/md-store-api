import { IsString, IsOptional, IsUUID, IsUrl, IsInt, Min, IsBoolean, MaxLength } from 'class-validator';

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

  @IsOptional()
  @IsUUID('4', { message: 'معرّف التصنيف الأب غير صالح' })
  parentId?: string;

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
}