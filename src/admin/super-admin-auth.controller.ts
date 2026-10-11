import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsNotEmpty, IsString, Matches } from 'class-validator';
import { SuperAdminSessionGuard } from './guard/super-admin.guard';
import { SuperAdminAuthService } from './super-admin-auth.service';

class GoogleCredentialDto {
  @IsString()
  @IsNotEmpty()
  credential: string;
}

class PinDto {
  @IsString()
  @IsNotEmpty()
  challenge_token: string;

  @Matches(/^\d{6}$/, { message: 'رمز PIN يجب أن يكون 6 أرقام' })
  pin: string;
}

// دخول لوحة المنصة (md-store-admin):
// Google ← جلسة أسبوع ← 3 أسماء عشوائية (ZZMMHH) ← رقمان من كل رمز ← دخول 30 دقيقة
@Controller('auth/admin')
export class SuperAdminAuthController {
  constructor(private readonly auth: SuperAdminAuthService) { }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  google(@Body() dto: GoogleCredentialDto) {
    return this.auth.googleLogin(dto.credential);
  }

  @Post('pin/challenge')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SuperAdminSessionGuard)
  challenge(@Req() req: any) {
    return this.auth.pinChallenge(req.superAdmin.id);
  }

  @Post('pin')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(SuperAdminSessionGuard)
  pin(@Req() req: any, @Body() dto: PinDto) {
    return this.auth.verifyPin(req.superAdmin.id, dto.challenge_token, dto.pin);
  }
}
