import { Controller, Get, Headers, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ShippingSyncService } from './shipping-sync.service';

/**
 * يستدعيه Vercel Cron (الدوال على Vercel لا تبقى تعمل لتشغيل @Cron).
 * Vercel يرسل Authorization: Bearer <CRON_SECRET> تلقائياً إذا ضُبط المتغير.
 */
@Controller('internal/cron')
export class ShippingSyncController {
  constructor(
    private readonly sync: ShippingSyncService,
    private readonly config: ConfigService,
  ) {}

  @Get('shipping-sync')
  run(@Headers('authorization') auth?: string) {
    const secret = this.config.get<string>('CRON_SECRET');
    if (!secret || auth !== `Bearer ${secret}`) throw new UnauthorizedException();
    return this.sync.sync();
  }
}
