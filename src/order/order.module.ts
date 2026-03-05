// =====================================================
// order.module.ts
// =====================================================

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Order } from './entities/order.entity';

import { Product } from '../product/entities/product.entity';
import { Offer } from '../product/entities/offer.entity';
import { VariantDetail } from '../product/entities/variant-detail.entity';
import { Store } from '../store/entities/store.entity';

import { OrdersService } from './order.service';
import { OrdersController } from './order.controller';
import { NtfyModule } from '../ntfy/ntfy.module';
import { Shipping } from 'src/shipping/entity/shipping.entity';
import { Commune } from 'src/shipping/entity/commune.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      Product,
      Offer,
      VariantDetail,
      Store,
      Shipping,
      Commune,
    ]),
    NtfyModule
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService], 
  
})
export class OrderModule {}