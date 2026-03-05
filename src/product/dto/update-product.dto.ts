import { 
  IsString, 
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

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'اسم المنتج يجب أن يكون أقل من 200 حرف' })
  name?: string;

  @IsOptional()
  @IsNumber({}, { message: 'سعر المنتج يجب أن يكون رقماً' })
  @Min(0, { message: 'سعر المنتج يجب أن يكون موجباً' })
  price?: number;

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
  sku?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  slug?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsUUID('4', { message: 'معرف التصنيف غير صالح' })
  categoryId?: string | null; // يمكن إزالة التصنيف بـ null

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttributeDto)
  attributes?: AttributeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantDetailDto)
  variantDetails?: VariantDetailDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OfferDto)
  offers?: OfferDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true, message: 'يجب أن تكون جميع الروابط صالحة' })
  images?: string[];
}