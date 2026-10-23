import { IsInt, IsNumber, IsOptional, Min, IsString, MaxLength } from 'class-validator';

// تعديل سريع من صفحة إحصائيات المنتج (بدون إعادة حفظ المنتج كاملاً)
export class UpdateOfferQuickDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;
}

export class UpdateVariantQuickDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  // باركود النسخة (فريد داخل المتجر)؛ "" يحذفه
  @IsOptional()
  @IsString()
  @MaxLength(64)
  barcode?: string | null;
}
