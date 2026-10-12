import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber, Min, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

// إضافة اختيارية للمنتج (مثلاً: جبن إضافي) — سعرها يُضاف لسعر الوحدة
export class AddonDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  id: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
