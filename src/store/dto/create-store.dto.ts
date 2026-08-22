// create-store.dto.ts
import { IsString, IsOptional, IsUUID, IsBoolean, IsNumber, Min } from 'class-validator';

export class CreateStoreDto {
  @IsString() name: string;
  @IsString() subdomain: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsUUID() nicheId?: string;
  @IsOptional() @IsBoolean() cart?: boolean;
  @IsOptional() @IsBoolean() supportQty?: boolean;
  @IsOptional() @IsBoolean() supportFreeShipping?: boolean;
  @IsOptional() @IsNumber() @Min(0) freeShippingMinAmount?: number;
}