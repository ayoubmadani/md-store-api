import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { VariantDto } from './variant.dto';

export class AttributeDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  type: string; // color, size, text

  @IsString()
  @IsNotEmpty()
  name: string; // Color, Size

  @IsOptional()
  @IsString()
  displayMode?: string; // color, image

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantDto)
  variants: VariantDto[];
}