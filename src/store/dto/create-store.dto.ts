// create-store.dto.ts
import { IsString, IsOptional, IsUUID } from 'class-validator';

export class CreateStoreDto {
  @IsString() name: string;
  @IsString() subdomain: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsUUID() nicheId?: string;
}