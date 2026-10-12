import { IsBoolean, IsDate, IsEnum, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';
import { AuthProvider } from '../entities/user.entity';

// ما يحق للمستخدم تعديله في حسابه عبر PATCH /user — ValidationPipe (whitelist)
// يحذف أي حقل آخر، فلا يمكن تمرير role أو isVerified أو confirmationAccess...
// كلمة المرور لها مسارها الخاص: PATCH /user/password
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  topic?: string;

  @IsOptional()
  @IsBoolean()
  isNtfy?: boolean;
}

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