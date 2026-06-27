import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupportService } from './support.service';
import { SupportController } from './support.controller';
import { User } from '../user/entities/user.entity';
import { Theme } from '../theme/entities/theme.entity';
import { ThemeUser } from '../theme/entities/theme-user.entity';
import { Subscription } from '../subscription/entities/subscription.entity';
import { Plan } from '../subscription/entities/plan.entity';
import { PaymentModule } from '../payment/payment.module';
import { SupportUser } from './entities/support-users.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([User, Theme, ThemeUser, Subscription, Plan, SupportUser]),
        PaymentModule,
    ],
    controllers: [SupportController],
    providers: [SupportService],
})
export class SupportModule {}
