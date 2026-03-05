// create-niche.dto.ts
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateNicheDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  icon: string;
}