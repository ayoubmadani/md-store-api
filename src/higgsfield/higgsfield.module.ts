import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../product/entities/product.entity';
import { ImageProduct } from '../image-product/entities/image-product.entity';
import { ImageModule } from '../image/image.module';
import { StoreModule } from '../store/store.module';
import { HiggsfieldService } from './higgsfield.service';
import { HiggsfieldController } from './higgsfield.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Product, ImageProduct]), ImageModule, StoreModule],
  controllers: [HiggsfieldController],
  providers: [HiggsfieldService],
})
export class HiggsfieldModule {}
