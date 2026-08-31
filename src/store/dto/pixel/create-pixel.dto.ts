import { IsEnum, IsString, IsOptional, IsBoolean, IsJSON, IsUUID, MaxLength, ValidateIf } from 'class-validator';

export type PixelType = 'facebook' | 'tiktok' | 'google' | 'snapchat';
export type PixelScope = 'store' | 'landing_page';

export class CreatePixelDto {
  @IsString()
  @MaxLength(100)
  @IsOptional()
  name?: string;

  @IsEnum(['facebook', 'tiktok', 'google', 'snapchat'])
  type: PixelType;

  @IsString()
  pixelId: string;

  @IsEnum(['store', 'landing_page'])
  @IsOptional()
  scope?: PixelScope;

  // Legacy field — still accepted so the old LandingPage-scoped rows/flows
  // keep working, but no dashboard UI sets this anymore.
  @ValidateIf((dto) => dto.scope === 'landing_page' && !dto.builderPageId)
  @IsUUID()
  landingPageId?: string;

  // Set when a pixel is created from inside the page-builder editor.
  @ValidateIf((dto) => dto.scope === 'landing_page' && !dto.landingPageId)
  @IsUUID()
  builderPageId?: string;

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