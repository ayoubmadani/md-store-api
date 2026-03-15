import { Controller, Get, Post, Body, Patch, UseGuards } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { GetUser } from 'src/user/decorator/get-user.decorator';
import { AuthGuard } from 'src/auth/guard/auth.guard';

@Controller('subscription')
@UseGuards(AuthGuard)
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) { }

  /**
   * POST /subscription/subscribe
   * الاشتراك في خطة — يخصم من المحفظة ويُفعّل الاشتراك
   */
  @Post('subscribe')
  async subscribe(
    @GetUser() user: any,
    @Body('planId') planId: string,
  ) {
    const userId = user.id || user.sub
    return this.subscriptionService.subscribeToPlan(userId, planId);
  }

  /**
   * GET /subscription/my
   * جلب الاشتراك النشط للمستخدم الحالي — يُرجع null إذا لم يوجد
   */
  @Get('my')
  async getMySub(@GetUser() user: any) {
    const userId = user.id || user.sub
    return this.subscriptionService.findSub(userId);
  }

  /**
   * PATCH /subscription/my/auto-renew
   * تفعيل أو إيقاف التجديد التلقائي للاشتراك النشط
   */
  @Patch('my/auto-renew')
  async toggleAutoRenew(
    @GetUser() user: any,
    @Body('autoRenew') autoRenew: boolean,
  ) {
    const userId = user.id || user.sub
    return this.subscriptionService.setAutoRenew(userId, autoRenew);
  }
}

