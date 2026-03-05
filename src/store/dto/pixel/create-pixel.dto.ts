// src/stores/dto/create-pixel.dto.ts
import { IsEnum, IsString, IsOptional, IsBoolean, IsJSON } from 'class-validator';

export type PixelType = 'facebook' | 'tiktok' | 'google' | 'snapchat';

export class CreatePixelDto {
  @IsEnum(['facebook', 'tiktok', 'google', 'snapchat'])
  type: PixelType;

  @IsString()
  pixelId: string;

  @IsString()
  @IsOptional()
  accessToken?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsOptional()
  events?: string[];

  @IsOptional()
  customData?: Record<string, any>;
}