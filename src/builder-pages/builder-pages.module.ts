import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BuilderPagesService } from './builder-pages.service';
import { BuilderPagesController } from './builder-pages.controller';
import { BuilderPage } from './entities/builder-page.entity';
import { Product } from '../product/entities/product.entity';
import { StorePixel } from '../store/entities/store-pixel.entity';
import { Domain } from '../domain/entities/domain.entity';
import { Store } from '../store/entities/store.entity';
import { AiModule } from '../ai/ai.module';
import { ImageModule } from '../image/image.module';
import { IMAGE_PAGE_SECRET, ImagePageService } from './image-page/image-page.service';
import { ImagePageQuotaService } from './image-page/image-page-quota.service';
import { ImagePageGeneration } from './image-page/image-page-generation.entity';
import { ReplicateCutoutService } from './image-page/replicate-cutout.service';

@Module({
  controllers: [BuilderPagesController],
  providers: [
    BuilderPagesService,
    ImagePageService,
    ImagePageQuotaService,
    ReplicateCutoutService,
    { provide: IMAGE_PAGE_SECRET, inject: [ConfigService], useFactory: (c: ConfigService) => c.get<string>('JWT_SECRET') || '' },
  ],
  exports: [BuilderPagesService],
  imports: [TypeOrmModule.forFeature([BuilderPage, Product, StorePixel, Domain, Store, ImagePageGeneration]), AiModule, ImageModule],
})
export class BuilderPagesModule {}
