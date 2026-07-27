import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class SetShippingProviderDto {
  @IsString()
  @IsNotEmpty()
  providerName: string;

  @IsString()
  @IsOptional()
  accountName:string

  @IsObject()
  credentials: Record<string, string>;
}

export class UpdateShippingProviderDto {
  @IsString()
  @IsOptional()
  accountName?: string;

  @IsObject()
  @IsOptional()
  credentials?: Record<string, string>;
}

export class CreateShippingOrderDto {
  @IsObject()
  orderData: Record<string, unknown>;
}

export class GetRatesDto {
  fromWilayaId?: number;
  toWilayaId?: number;
}