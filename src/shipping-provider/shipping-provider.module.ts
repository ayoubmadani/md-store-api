import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { ShippingProviderController } from './shipping-provider.controller';
import { ShippingProviderService } from './shipping-provider.service';
import { Order } from '../order/entities/order.entity';

@Module({
  imports: [ConfigModule, HttpModule, TypeOrmModule.forFeature([Order])],
  controllers: [ShippingProviderController],
  providers: [ShippingProviderService],
  exports: [ShippingProviderService],
})
export class ShippingProviderModule {}
