// create-store.dto.ts
import { IsString, IsOptional, IsUUID, IsBoolean, IsNumber, Min, Matches } from 'class-validator';

export class CreateStoreDto {
  @IsString() name: string;
  @IsString() subdomain: string;
  @IsOptional() @IsString() currency?: string;
  // دولة المتجر (DZ افتراضياً) — تُحدَّد عند الإنشاء فقط
  @IsOptional() @Matches(/^[A-Z]{2}$/) country?: string;
  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsUUID() nicheId?: string;
  @IsOptional() @IsBoolean() cart?: boolean;
  @IsOptional() @IsBoolean() supportQty?: boolean;
  @IsOptional() @IsBoolean() supportFreeShipping?: boolean;
  @IsOptional() @IsNumber() @Min(0) freeShippingMinAmount?: number;
  // بدون التصنيفات والمنتجات التجريبية (مثلاً Claude ينشئ منتجات خاصة بنشاط المتجر)
  @IsOptional() @IsBoolean() skipDemoContent?: boolean;
}