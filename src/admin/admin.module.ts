import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from '../category/entities/category.entity';
import { ImageProduct } from '../image-product/entities/image-product.entity';
import { Image } from '../image/entities/image.entity';
import { LandingPage } from '../landing-page/entities/landing-page.entity';
import { Niche } from '../niche/entities/niche.entity';
import { Order } from '../order/entities/order.entity';
import { Attribute } from '../product/entities/attribute.entity';
import { Offer } from '../product/entities/offer.entity';
import { Product } from '../product/entities/product.entity';
import { VariantDetail } from '../product/entities/variant-detail.entity';
import { Variant } from '../product/entities/variant.entity';
import { Commune } from '../shipping/entity/commune.entity';
import { Shipping } from '../shipping/entity/shipping.entity';
import { Wilaya } from '../shipping/entity/wilaya.entity';
import { StoreHeroSection } from '../store/entities/hero-section.entity';
import { StoreContact } from '../store/entities/store-contact.entity';
import { StoreDesign } from '../store/entities/store-design.entity';
import { StorePixel } from '../store/entities/store-pixel.entity';
import { StoreTopBar } from '../store/entities/store-topBar.entity';
import { Store } from '../store/entities/store.entity';
import { ThemeType } from '../theme/entities/theme-type.entity';
import { ThemeUser } from '../theme/entities/theme-user.entity';
import { Theme } from '../theme/entities/theme.entity';
import { User } from '../user/entities/user.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admine.service';


@Module({
    imports: [
        TypeOrmModule.forFeature([
            User,
            Product,
            Attribute,
            Offer,
            VariantDetail,
            Variant,
            Store,
            StoreHeroSection,
            StoreContact,
            StoreDesign,
            StorePixel,
            StoreTopBar,
            Order,
            ThemeUser,
            ThemeType,
            Theme,
            Commune,
            Shipping,
            Wilaya,
            Category,
            Image,
            ImageProduct,
            LandingPage,
            Niche,
            
        ]),
    ],
    controllers: [AdminController],
    providers: [AdminService],
})
export class AdminModule { }