import { IsString, IsNumber, IsOptional, IsEnum, IsUUID, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum StatusEnum {
  PENDING   = 'pending',
  APPL1     = 'appl1',
  APPL2     = 'appl2',
  APPL3     = 'appl3',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  RETURNED  = 'returned',
  DELIVERED = 'delivered',
  POSTPONED = 'postponed',
  SHIPPING  = 'shipping',
}

export enum TypeShipEnum {
  HOME   = 'home',
  OFFICE = 'office',
}

export class UpdateOrderDto {
  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  customerWilayaId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  customerCommuneId?: number;

  @IsOptional()
  @IsEnum(TypeShipEnum)
  typeShip?: TypeShipEnum;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceShip?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unityPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsEnum(StatusEnum)
  status?: StatusEnum;

  @IsOptional()
  @IsUUID()
  variantDetailId?: string;

  @IsOptional()
  @IsUUID()
  offerId?: string | null;
}