import { Module } from '@nestjs/common';
import { ShippingProviderModule } from '../shipping-provider/shipping-provider.module';
import { ConfirmationModule } from '../confirmation/confirmation.module';
import { ShippingSyncService } from './shipping-sync.service';
import { ShippingSyncController } from './shipping-sync.controller';

@Module({
  imports: [ShippingProviderModule, ConfirmationModule],
  controllers: [ShippingSyncController],
  providers: [ShippingSyncService],
})
export class ShippingSyncModule {}
