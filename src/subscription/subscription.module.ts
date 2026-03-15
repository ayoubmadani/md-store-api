import { Module } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Plan } from './entities/plan.entity';
import { Subscription } from './entities/subscription.entity';
import { PaymentModule } from '../payment/payment.module';
import { PlansController } from './plan.controller';
import { PlansService } from './plan.service';

@Module({
  controllers: [SubscriptionController,PlansController],
  providers: [SubscriptionService,PlansService],
  exports: [SubscriptionService,PlansService],
  imports: [
    TypeOrmModule.forFeature([Plan,Subscription]),
    PaymentModule,
  ],

})
export class SubscriptionModule {}
