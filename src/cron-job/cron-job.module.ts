import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CronJobService } from './cron-job.service';
import { Subscription } from '../subscription/entities/subscription.entity';
import { Store } from '../store/entities/store.entity';
import { Product } from '../product/entities/product.entity';

@Module({
  imports: [
    // يجب تسجيل الـ Entities هنا لكي يتمكن الـ Service من استخدام الـ Repositories
    TypeOrmModule.forFeature([Subscription, Store, Product]),
  ],
  providers: [CronJobService],
})
export class CronJobModule {}