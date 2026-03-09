// create-niche.dto.ts
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateNicheDto {
  @IsString()
  @IsNotEmpty()
  name_en: string;

  @IsString()
  @IsNotEmpty()
  name_ar: string;

  @IsString()
  @IsNotEmpty()
  name_fr: string;

  @IsString()
  @IsNotEmpty()
  icon: string;
}