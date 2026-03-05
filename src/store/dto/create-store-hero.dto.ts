// create-store-hero.dto.ts
import { IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateStoreHeroDto {
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() subtitle?: string;
}