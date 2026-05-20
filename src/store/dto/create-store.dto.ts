// create-store.dto.ts
import { IsString, IsOptional, IsUUID, IsBoolean } from 'class-validator';

export class CreateStoreDto {
  @IsString() name: string;
  @IsString() subdomain: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsUUID() nicheId?: string;
  @IsOptional() @IsBoolean() cart?: boolean;
}