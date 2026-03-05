import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { AuthProvider } from '../entities/user.entity';

export class CreateUserDto {
  @IsString()
  username: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsEnum(AuthProvider)
  provider?: AuthProvider;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}