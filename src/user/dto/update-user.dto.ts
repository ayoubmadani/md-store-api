import { IsBoolean, IsDate, IsEnum, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';
import { AuthProvider } from '../entities/user.entity';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsNumber()
  otp?:number;

  @IsString()
  @IsOptional()
  topic:string;

  @IsBoolean()
  @IsOptional()
  isNtfy? : boolean

  @IsDate()
  otpExpires?:Date;

  @IsBoolean()
  isVerified?:boolean

  @IsEnum(AuthProvider)
  provider?:AuthProvider
}