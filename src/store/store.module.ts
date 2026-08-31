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
import { UserModule } from '../user/user.module';
import { PublicStoreController } from './public-store.controller';
import { PublicStoreService } from './public-store.service';
import { Product } from '../product/entities/product.entity';
import { CategoryNiche } from '../niche/entities/category-niche.entity';
import { ImageProduct } from '../image-product/entities/image-product.entity';
import { LandingPage } from '../landing-page/entities/landing-page.entity';
import { BuilderPage } from '../builder-pages/entities/builder-page.entity';

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
      Product,
      CategoryNiche,
      ImageProduct,
      LandingPage, // للتحقق من ملكية صفحة الهبوط عند ربط بكسل بها
      BuilderPage, // للتحقق من ملكية صفحة المحرر عند ربط بكسل بها
    ]),
    SubscriptionModule,
    UserModule,
  ],
  controllers: [StoreController , PublicStoreController],
  providers: [StoreService , PublicStoreService],
  exports: [StoreService, TypeOrmModule],
})
export class StoreModule {}