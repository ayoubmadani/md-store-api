import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryService } from './category.service';
import { CategoryController } from './category.controller';
import { Category } from './entities/category.entity';
import { Product } from '../product/entities/product.entity';
import { StoreModule } from '../store/store.module';
import { Store } from 'src/store/entities/store.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Category, 
      Store, 
      Product, // ✅ مهم جداً: إضافة Product للحقن في Service
    ]),
    StoreModule, // للوصول إلى StoreService
  ],
  controllers: [CategoryController],
  providers: [CategoryService],
  exports: [CategoryService, TypeOrmModule], // تصدير CategoryService و TypeOrmModule للاستخدام في modules أخرى
})
export class CategoryModule {}