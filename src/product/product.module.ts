import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Product } from "./entities/product.entity";
import { Variant } from "./entities/variant.entity";
import { Attribute } from "./entities/attribute.entity";
import { VariantDetail } from "./entities/variant-detail.entity";
import { Offer } from "./entities/offer.entity";
import { ImageProduct } from "../image-product/entities/image-product.entity";
import { ProductController } from "./product.controller";
import { ProductService } from "./product.service";
import { StoreModule } from "../store/store.module";
import { CategoryModule } from "../category/category.module";
import { ProductPublicController } from "./product-public.controller";
import { Store } from "..//store/entities/store.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product, 
      Attribute, 
      Variant, 
      VariantDetail, 
      Offer,
      Store,
      ImageProduct, // ✅ إضافة ImageProduct
    ]),
    StoreModule, // للوصول إلى StoreService
    CategoryModule, // للوصول إلى CategoryService إذا لزم الأمر
  ],
  controllers: [ProductController, ProductPublicController],
  providers: [ProductService],
  exports: [ProductService, TypeOrmModule], // تصدير للاستخدام في modules أخرى
})
export class ProductModule {}