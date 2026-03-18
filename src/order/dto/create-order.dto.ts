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

  @ApiProperty({ description: 'الكمية', minimum: 1, maximum: 100 })
  @IsNumber()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  quantity: number = 1;

  @ApiProperty({ description: 'نوع التوصيل', enum: TypeShipEnum, default: TypeShipEnum.OFFICE })
  @IsEnum(TypeShipEnum)
  typeShip: TypeShipEnum = TypeShipEnum.OFFICE;

  @ApiProperty({ description: 'سعر التوصيل' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  priceShip: number;


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
  customerWilayaId: number;

  @ApiProperty({ description: 'البلدية' })
  @IsNumber()
  customerCommuneId: number;

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
  lpId?:string
}