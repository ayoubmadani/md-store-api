import { Module } from '@nestjs/common';
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

@Module({
  controllers: [BuilderPagesController],
  providers: [BuilderPagesService],
  imports: [TypeOrmModule.forFeature([BuilderPage, Product, StorePixel, Domain, Store]), AiModule, ImageModule],
})
export class BuilderPagesModule {}
