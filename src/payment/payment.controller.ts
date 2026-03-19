import { Controller, Post, Req, Res, Headers, HttpStatus, Get, UseGuards, Body } from '@nestjs/common';
import type { Request, Response } from 'express';
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

  @Post('top-up')
  @UseGuards(AuthGuard)
  createTopUpSession(
    @GetUser() user: any,
    @Body('amount') amount: any
  ) {
    const userId = user.sub || user.id;
    return this.paymentService.createTopUpSession(userId, amount);
  }
}