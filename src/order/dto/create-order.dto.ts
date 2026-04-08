// =====================================================
// dto/create-order.dto.ts
// =====================================================

import {
  IsString, IsUUID, IsNumber, IsEnum, IsOptional,
  Min, Max, IsPhoneNumber, Length, ValidateIf,
  IsNotEmpty,
  Matches
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TypeShipEnum } from '../entities/order.entity';
import { Type } from 'class-transformer';

export class CreateOrderDto {
  @ApiProperty({ description: 'معرف المنتج' })
  @IsUUID()
  productId: string;

  @ApiPropertyOptional({ description: 'معرف المتغير' })
  @IsOptional()
  @IsUUID()
  variantDetailId?: string;

  @ApiPropertyOptional({ description: 'معرف العرض' })
  @IsOptional()
  @IsUUID()
  offerId?: string;

  @ApiPropertyOptional({ description: 'معرف العرض' })
  @IsOptional()
  @IsUUID()
  selectedOffer?: string;

  @ApiProperty({ description: 'الكمية', minimum: 1, maximum: 100 })
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  quantity: number = 1;

  @ApiProperty({ description: 'نوع التوصيل', enum: TypeShipEnum, default: TypeShipEnum.OFFICE })
  @IsEnum(TypeShipEnum)
  @IsOptional()
  typeShip?: TypeShipEnum;

  @ApiProperty({ description: 'نوع التوصيل', enum: TypeShipEnum, default: TypeShipEnum.OFFICE })
  @IsEnum(TypeShipEnum)
  @IsOptional()
  typeLivraison?: TypeShipEnum;

  @ApiProperty({ description: 'سعر التوصيل' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  priceShip?: number;

  @ApiProperty({ description: 'سعر التوصيل' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  priceLivraison?: number


  @ApiProperty({ description: 'سعر التوصيل' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  priceLoss: number;

  @IsNumber()
  totalPrice: number

  @IsNumber()
  @IsOptional()
  unityPrice?: number

  @IsOptional()
  @IsUUID()
  variantId?: String

  @IsUUID()
  customerId?: string;

  @ApiProperty({ description: 'اسم العميل' })
  @IsString()
  @Length(2, 100)
  customerName: string;

  @ApiProperty({ description: 'الولاية' })
  @IsNumber()
  @IsOptional()
  customerWilayaId?: number;

  @ApiProperty({ description: 'الولاية' })
  @IsNumber()
  @IsOptional()
  customerWelaya?: number;

  @ApiProperty({ description: 'البلدية' })
  @IsNumber()
  @IsOptional()
  customerCommuneId?: number;

  @ApiProperty({ description: 'البلدية' })
  @IsNumber()
  @IsOptional()
  customerCommune?: number;

  @IsNotEmpty({ message: 'رقم الهاتف مطلوب' })
  @IsString()
  @Matches(/^(05|06|07)\d{8}$/, {
    message: 'يرجى إدخال رقم هاتف جزائري صحيح (10 أرقام)',
  })
  customerPhone: string;

  @ApiPropertyOptional({ description: 'ملاحظات العميل' })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  customerNote?: string;

  @ApiPropertyOptional({ description: 'Domain للتتبع' })
  @IsOptional()
  @IsString()
  domain?: string;

  @IsOptional()
  @IsString()
  platform?: string

  @IsOptional()
  @IsString()
  lpId?: string

  @IsOptional()
  @IsString()
  storeId?: string
}