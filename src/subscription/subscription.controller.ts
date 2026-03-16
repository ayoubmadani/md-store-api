import { Controller, Get, Post, Body, Patch, UseGuards } from '@nestjs/common';
import { IsBoolean, IsEnum, IsUUID, IsNotEmpty } from 'class-validator';
import { SubscriptionService } from './subscription.service';
import { GetUser } from 'src/user/decorator/get-user.decorator';
import { AuthGuard } from 'src/auth/guard/auth.guard';

class SubscribeDto {
  @IsUUID()
  @IsNotEmpty()
  planId: string;

  @IsEnum(['month', 'year'])
  interval: 'month' | 'year';
}

class AutoRenewDto {
  @IsBoolean()
  autoRenew: boolean;
}

@Controller('subscription')
@UseGuards(AuthGuard)
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  private uid(user: any): string {
    return user.id ?? user.sub;
  }

  @Post('subscribe')
  async subscribe(@GetUser() user: any, @Body() dto: SubscribeDto) {
    return this.subscriptionService.subscribeToPlan(this.uid(user), dto.planId, dto.interval);
  }

  @Get('my')
  async getMySub(@GetUser() user: any) {
    return this.subscriptionService.findSub(this.uid(user));
  }

  @Patch('my/auto-renew')
  async toggleAutoRenew(@GetUser() user: any, @Body() dto: AutoRenewDto) {
    return this.subscriptionService.setAutoRenew(this.uid(user), dto.autoRenew);
  }
}