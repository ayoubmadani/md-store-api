// src/theme/theme.module.ts
import { Module } from '@nestjs/common';
import { ThemeService } from './theme.service';
import { ThemeController } from './theme.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThemeUser } from './entities/theme-user.entity';
import { Theme } from './entities/theme.entity';
import { ThemeType } from './entities/theme-type.entity';
import { ThemePlan } from './entities/theme-plan.entity';
import { TypeThemeService } from './type-theme.service';
import { Store } from '../store/entities/store.entity';
import { PaymentModule } from '../payment/payment.module';
import { CouponModule } from '../coupon/coupon.module';
import { SubscriptionModule } from '../subscription/subscription.module';

@Module({
  controllers: [ThemeController],
  providers: [ThemeService, TypeThemeService],
  imports: [
    TypeOrmModule.forFeature([
      ThemeUser,
      Theme,
      ThemeType,
      ThemePlan,
      Store,
    ]),
    PaymentModule,
    CouponModule,
    SubscriptionModule,
  ],
})
export class ThemeModule {}