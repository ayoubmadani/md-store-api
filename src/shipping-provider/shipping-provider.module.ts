import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoreShippingSettings } from './entities/store-shipping-settings.entity';
import { ShippingProviderController } from './shipping-provider.controller';
import { ShippingProviderService } from './shipping-provider.service';
import { Order } from '../order/entities/order.entity';

@Module({
  imports: [TypeOrmModule.forFeature([StoreShippingSettings,Order])],
  controllers: [ShippingProviderController],
  providers: [ShippingProviderService],
  exports: [ShippingProviderService], // Export for use in OrdersModule etc.
})
export class ShippingProviderModule {}