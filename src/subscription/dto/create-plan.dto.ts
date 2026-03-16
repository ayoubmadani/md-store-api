import {
  IsString, IsNumber, IsOptional, IsBoolean,
  IsNotEmpty, MaxLength, Min, ValidateNested,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateFeaturesDto {
  @IsInt() @Min(0)
  storeNumber: number;

  @IsInt() @Min(0)
  productNumber: number;

  @IsInt() @Min(0)
  landingPageNumber: number;

  @IsBoolean()
  isNtfy: boolean;

  @IsInt() @Min(0)
  pixelTiktokNumber: number;

  @IsInt() @Min(0)
  pixelFacebookNumber: number;

  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  commission: number;

  @IsOptional()
  theme?: any;
}

export class CreatePlanDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  monthlyPrice: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  yearlyPrice: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @ValidateNested()
  @Type(() => CreateFeaturesDto)
  @IsNotEmpty()
  features: CreateFeaturesDto;

  @IsString()
  @IsOptional()
  stripePriceId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}