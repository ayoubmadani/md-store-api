import { Controller, Post, Req, Res, Headers, HttpStatus, Get, UseGuards, Body, Redirect, Query } from '@nestjs/common';
import type { Request, Response } from 'express';
import { verifySignature } from '@chargily/chargily-pay';
import { PaymentService } from './payment.service';
import { BinanceTopupService } from './binance/binance-topup.service';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '../auth/guard/auth.guard';
import { GetUser } from '../user/decorator/get-user.decorator';

@Controller('payment')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly binanceTopup: BinanceTopupService,
    private readonly config: ConfigService
  ) { }

  @Get('balance')
  @UseGuards(AuthGuard)
  getBalance(
    @GetUser() user: any,
  ) {
    const userId = user.id || user.sub;
    return this.paymentService.getBalanceUser(userId);
  }

  @Post('webhook')
  async handleWebhook(
    @Headers('signature') signature: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const payload = (req as any).rawBody;
    const secretKey = this.config.get<string>('chargily_Secret_key')!;

    if (!signature) {
      (res as any).status(HttpStatus.BAD_REQUEST);
      return 'Signature header is missing';
    }

    try {
      const isValid = verifySignature(payload, signature, secretKey);

      if (!isValid) {
        console.log('Signature is invalid');
        (res as any).status(HttpStatus.FORBIDDEN);
        return 'Invalid signature';
      }

      const event = (req as any).body;
      await this.paymentService.handleWebhook(event);

      (res as any).status(HttpStatus.OK);
      return 'OK';

    } catch (error) {
      console.error('Webhook processing error:', error);
      (res as any).status(HttpStatus.INTERNAL_SERVER_ERROR);
      return 'Error processing webhook';
    }
  }


  @Get('payment-success')
  @Redirect()
  paymentSuccess(@Query('checkout_id') checkoutId: string) {
    return this.paymentService.paymentStatus(checkoutId , "Success");
  }

  @Get('payment-failed')
  @Redirect()
  paymentFailed(@Query('checkout_id') checkoutId: string) {
    return this.paymentService.paymentStatus(checkoutId , "Failed");
  }

  // شحن محفظة شركة تأكيد من confirm-app — الرجوع إليها بعد الدفع
  @Get('payment-success-confirm')
  @Redirect()
  paymentSuccessConfirm(@Query('checkout_id') checkoutId: string) {
    return this.paymentService.paymentStatus(checkoutId , "Success", 'confirm');
  }

  @Get('payment-failed-confirm')
  @Redirect()
  paymentFailedConfirm(@Query('checkout_id') checkoutId: string) {
    return this.paymentService.paymentStatus(checkoutId , "Failed", 'confirm');
  }
  

  // ---- شحن المحفظة بـ USDT (Binance) ----
  @Get('binance/config')
  @UseGuards(AuthGuard)
  binanceConfig() {
    return this.binanceTopup.publicConfig();
  }

  // التاجر يحوّل من حسابه في Binance ثم يُدخل رقم التحويل فقط
  @Post('binance/claim')
  @UseGuards(AuthGuard)
  binanceClaim(@GetUser() user: any, @Body('txId') txId: string) {
    return this.binanceTopup.claim(user.sub || user.id, txId);
  }

  @Post('top-up')
  @UseGuards(AuthGuard)
  createTopUpSession(
    @GetUser() user: any,
    @Body('amount') amount: any,
    @Body('app') app?: string,
  ) {
    const userId = user.sub || user.id;
    const numericAmount = Number(amount);
    return this.paymentService.createTopUpSession(userId, numericAmount, app);
  }
}