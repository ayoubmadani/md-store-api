import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';

export class GenerateImagePageDto {
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  // السعر عند الوصف اليدوي (بدون منتج)
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @IsIn(['ar', 'fr', 'en'])
  language: 'ar' | 'fr' | 'en';

  // مرح، فاخر، رياضي، طبي، أطفال، تقليدي، عصري بسيط، أو auto
  @IsOptional()
  @IsString()
  @MaxLength(40)
  style?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @Matches(/^#[0-9a-fA-F]{6}$/, { each: true })
  palette: string[];

  // ألوان خلفية الصورة الأصلية (قبل إزالتها) — Claude يختار منها أو من ألوان المنتج أو يقترح
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @Matches(/^#[0-9a-fA-F]{6}$/, { each: true })
  backgroundPalette?: string[];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  cutouts: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(3)
  details?: number;
}
