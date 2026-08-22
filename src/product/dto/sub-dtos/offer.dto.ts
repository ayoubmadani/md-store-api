import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class OfferDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  subTitle?: string;

  @IsNotEmpty()
  quantity: string | number;

  @IsNotEmpty()
  price: string | number;

  @IsOptional()
  @IsBoolean()
  shippingFree?: boolean;
}