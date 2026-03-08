import { Controller, Post, Req, Res, Headers, HttpStatus, Get, UseGuards, Body } from '@nestjs/common';
// قم بتغيير الاستيراد العادي إلى Namespace import لحل مشكلة النوع
import * as express from 'express';
import { verifySignature } from '@chargily/chargily-pay';
import { PaymentService } from './payment.service';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '../auth/guard/auth.guard';
import { GetUser } from '../user/decorator/get-user.decorator';

@Controller('payment')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly config: ConfigService
  ) { }

  @Get('balance')
  @UseGuards(AuthGuard)
  getBalance(
    @GetUser() user:any,
  ){
    const userId = user.id || user.sub
    return this.paymentService.getBalanceUser(userId)
  }

  @Post('webhook')
  async handleWebhook(
    @Headers('signature') signature: string,
    @Req() req: express.Request,
    // إضافة passthrough تمنع حدوث التعارض مع Interceptors وتجنب الـ Crash
    @Res({ passthrough: true }) res: express.Response
  ) {
    // 1. الحصول على الجسم الخام (raw body) ضروري جداً للتحقق من التوقيع
    const payload = (req as any).rawBody;
    const secretKey = this.config.get<string>('chargily_Secret_key')!;

    // 2. التحقق من وجود التوقيع في الهيدرز
    if (!signature) {
      res.status(HttpStatus.BAD_REQUEST);
      return 'Signature header is missing';
    }

    try {
      // 3. التأكد من أن الطلب سليم وقادم من Chargily فعلاً باستخدام المفتاح السري
      const isValid = verifySignature(payload, signature, secretKey);

      if (!isValid) {
        console.log('Signature is invalid');
        res.status(HttpStatus.FORBIDDEN);
        return 'Invalid signature';
      }

      // 4. معالجة الحدث (مثل نجاح الدفع checkout.paid)
      const event = req.body;
      await this.paymentService.handleWebhook(event);

      // 5. الرد بحالة 200 ضروري لإعلام Chargily باستلام الإشعار بنجاح
      res.status(HttpStatus.OK);
      return 'OK';

    } catch (error) {
      console.error('Webhook processing error:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR);
      return 'Error processing webhook';
    }
  }

  @Post('top-up')
  @UseGuards(AuthGuard)
  createTopUpSession(
    @GetUser() user: any,
    @Body('amount') amount: any
  ) {
    const userId = user.sub || user.id
    return this.paymentService.createTopUpSession(userId, amount)
  }
}