import { BadRequestException, Body, Controller, Delete, Get, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '../auth/guard/auth.guard';
import { GetUser } from '../user/decorator/get-user.decorator';
import { AliexpressService } from './aliexpress.service';

@Controller('aliexpress')
export class AliexpressController {
  constructor(private readonly ali: AliexpressService, private readonly config: ConfigService) {}

  private getUserId(user: any): string {
    const userId = user?.id || user?.sub;
    if (!userId) throw new BadRequestException('User ID not found in token');
    return userId;
  }

  @Get('status')
  @UseGuards(AuthGuard)
  status(@GetUser() user: any) {
    return this.ali.status(this.getUserId(user));
  }

  // رابط صفحة موافقة AliExpress — الواجهة تفتحه
  @Get('connect')
  @UseGuards(AuthGuard)
  connect(@GetUser() user: any) {
    return { url: this.ali.authorizeUrl(this.getUserId(user)) };
  }

  @Delete('connect')
  @UseGuards(AuthGuard)
  disconnect(@GetUser() user: any) {
    return this.ali.disconnect(this.getUserId(user));
  }

  // يعود إليه AliExpress بعد الموافقة (Callback URL المسجّل في App Console)
  @Get('callback')
  async callback(@Query('code') code: string, @Query('state') state: string, @Res() res: any) {
    const back = `${(this.config.get<string>('FRONT_URL') || '').replace(/\/+$/, '')}/dashboard/products/create`;
    try {
      await this.ali.handleCallback(code, state);
      return res.redirect(`${back}?aliexpress=connected`);
    } catch (e: any) {
      return res.redirect(`${back}?aliexpress=error&message=${encodeURIComponent(e?.message || 'error')}`);
    }
  }

  @Post('import')
  @UseGuards(AuthGuard)
  importProduct(@GetUser() user: any, @Body() body: { url?: string; language?: string }) {
    return this.ali.importProduct(this.getUserId(user), body?.url || '', body?.language);
  }
}
