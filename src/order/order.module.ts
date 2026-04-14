import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Order }     from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { Product }   from '../product/entities/product.entity';
import { Store }     from '../store/entities/store.entity';
import { Shipping }  from '../shipping/entity/shipping.entity';

import { OrdersService }    from './order.service';
import { OrdersController } from './order.controller';
import { NtfyModule }       from '../ntfy/ntfy.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, Product, Store, Shipping]),
    NtfyModule,
  ],
  controllers: [OrdersController],
  providers:   [OrdersService],
  exports:     [OrdersService],
})
export class OrderModule {}