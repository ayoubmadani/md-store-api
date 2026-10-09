import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../order/entities/order.entity';
import { User } from '../user/entities/user.entity';
import { StoreModule } from '../store/store.module';
import { ShippingProviderModule } from '../shipping-provider/shipping-provider.module';
import { ConfirmationCompany } from './entities/confirmation-company.entity';
import { ConfirmationMember } from './entities/confirmation-member.entity';
import { StoreConfirmationCompany } from './entities/store-confirmation-company.entity';
import { ConfirmationLog } from './entities/confirmation-log.entity';
import { ConfirmationService } from './confirmation.service';
import { ConfirmationAgentService } from './confirmation-agent.service';
import { ConfirmationBillingService } from './confirmation-billing.service';
import { ConfirmationController, StoreConfirmationController } from './confirmation.controller';

// لا يستورد OrderModule — OrderModule هو من يستورد هذا الموديول (لدفع العمولة عند التسليم)
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ConfirmationCompany, ConfirmationMember, StoreConfirmationCompany, ConfirmationLog, Order, User,
    ]),
    StoreModule,
    ShippingProviderModule,
  ],
  controllers: [ConfirmationController, StoreConfirmationController],
  providers: [ConfirmationService, ConfirmationAgentService, ConfirmationBillingService],
  exports: [ConfirmationBillingService],
})
export class ConfirmationModule {}
