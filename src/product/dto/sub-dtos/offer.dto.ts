import { IsString, IsNotEmpty } from 'class-validator';

export class OfferDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNotEmpty()
  quantity: string | number;

  @IsNotEmpty()
  price: string | number;
}