// create-store-design.dto.ts
import { IsOptional, IsHexColor, IsString } from 'class-validator';

export class CreateStoreDesignDto {
  @IsOptional() @IsHexColor() primaryColor?: string;
  @IsOptional() @IsHexColor() secondaryColor?: string;
  @IsOptional() @IsString() logoUrl?: string;
}