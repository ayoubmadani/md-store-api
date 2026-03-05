import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

export class VariantDto {
  @IsString()
  @IsNotEmpty()
  id: string; // مثال: var-1770...

  @IsString()
  @IsNotEmpty()
  name: string; // مثال: "#ff0000" أو "XL"

  @IsString()
  @IsNotEmpty()
  value: string; // القيمة الفعلية

  @IsOptional()
  @IsString()
  imageId?: string;
}