import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { StoreService } from './store.service';
import { StoreController } from './store.controller';

import { Store } from './entities/store.entity';
import { StoreDesign } from './entities/store-design.entity';
import { StoreContact } from './entities/store-contact.entity';
import { StoreTopBar } from './entities/store-topBar.entity';
import { StoreHeroSection } from './entities/hero-section.entity';
import { StorePixel } from './entities/store-pixel.entity'; // 🆕

import { User } from '../user/entities/user.entity';
import { Niche } from '../niche/entities/niche.entity';
import { Category } from '../category/entities/category.entity';
import { SubscriptionModule } from '../subscription/subscription.module';
import { PublicStoreController } from './public-store.controller';
import { PublicStoreService } from './public-store.service';
import { Product } from '../product/entities/product.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Store,
      StoreDesign,
      StoreTopBar,
      StoreContact,
      StoreHeroSection,
      StorePixel, // ✅ تمت الإضافة
      User,
      Niche,
      Category,
      Product
    ]),
    SubscriptionModule,
  ],
  controllers: [StoreController , PublicStoreController],
  providers: [StoreService , PublicStoreService],
  exports: [StoreService, TypeOrmModule],
})
export class StoreModule {}