import { forwardRef, Module } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Plan } from './entities/plan.entity';
import { Subscription } from './entities/subscription.entity';
import { PaymentModule } from '../payment/payment.module';
import { PlansController } from './plan.controller';
import { PlansService } from './plan.service';
import { FeaturesEntity } from './entities/features.entity';
import { CouponModule } from '../coupon/coupon.module';
import { Store } from '../store/entities/store.entity';
import { ThemeUser } from '../theme/entities/theme-user.entity';
import { ThemePlan } from '../theme/entities/theme-plan.entity';

@Module({
  controllers: [SubscriptionController, PlansController],
  providers: [SubscriptionService, PlansService],
  exports: [SubscriptionService, PlansService],
  imports: [
    TypeOrmModule.forFeature([Plan, Subscription, FeaturesEntity, Store, ThemeUser, ThemePlan]),
    forwardRef(() => PaymentModule), // ✅ مهم لحل الاعتمادية الدائرية
    CouponModule,
  ],
})
export class SubscriptionModule {}