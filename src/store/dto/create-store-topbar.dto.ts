// create-store-topbar.dto.ts
import { IsOptional, IsString, IsBoolean, IsHexColor } from 'class-validator';

export class CreateStoreTopBarDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @IsString() text?: string;
  @IsOptional() @IsHexColor() color?: string;
}