// create-store-contact.dto.ts
import { IsOptional, IsEmail, IsString } from 'class-validator';

export class CreateStoreContactDto {
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() wilaya?: string;
}