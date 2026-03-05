import { 
  IsString, 
  IsNotEmpty, 
  IsNumber, 
  IsOptional, 
  IsArray, 
  ValidateNested, 
  IsUUID,
  IsBoolean,
  Min,
  MaxLength,
  IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AttributeDto } from './sub-dtos/attribute.dto';
import { VariantDetailDto } from './sub-dtos/variant-detail.dto';
import { OfferDto } from './sub-dtos/offer.dto';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty({ message: 'معرّف المنتج مطلوب' })
  id: string; // المعرف القادم من الفرونت إند

  @IsString()
  @IsNotEmpty({ message: 'اسم المنتج مطلوب' })
  @MaxLength(200, { message: 'اسم المنتج يجب أن يكون أقل من 200 حرف' })
  name: string;

  @IsNumber({}, { message: 'سعر المنتج يجب أن يكون رقماً' })
  @IsNotEmpty({ message: 'سعر المنتج مطلوب' })
  @Min(0, { message: 'سعر المنتج يجب أن يكون موجباً' })
  price: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  priceOriginal?: number;

  @IsOptional()
  @IsString()
  desc?: string;

  @IsOptional()
  @IsUrl({}, { message: 'رابط الصورة غير صالح' })
  productImage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sku?: string; // رمز المنتج

  @IsOptional()
  @IsString()
  @MaxLength(150)
  slug?: string; // للـ SEO

  @IsOptional()
  @IsNumber()
  @Min(0)
  stock?: number; // الكمية المتاحة

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsUUID('4', { message: 'معرف التصنيف غير صالح' })
  categoryId?: string;

  // التحقق من مصفوفة الخصائص (Attributes)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttributeDto)
  attributes: AttributeDto[];

  // التحقق من مصفوفة تفاصيل المتغيرات (Variant Details)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantDetailDto)
  variantDetails: VariantDetailDto[];

  // التحقق من مصفوفة العروض (Offers)
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => OfferDto)
  offers?: OfferDto[];

  // التحقق من مصفوفة روابط الصور
  @IsArray()
  @IsOptional()
  @IsString({ each: true, message: 'يجب أن تكون جميع الروابط صالحة' })
  images?: string[];
}