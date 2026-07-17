import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class GenerateBuilderPageDto {
  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID()
  @IsOptional()
  productId?: string;

  @IsIn(['ar', 'fr', 'en'])
  @IsOptional()
  language?: 'ar' | 'fr' | 'en';
}
