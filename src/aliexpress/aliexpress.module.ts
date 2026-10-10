import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AliexpressAccount } from './entities/aliexpress-account.entity';
import { AliexpressService } from './aliexpress.service';
import { AliexpressController, AliexpressStoreProductsController } from './aliexpress.controller';
import { ProductModule } from '../product/product.module';

@Module({
  imports: [TypeOrmModule.forFeature([AliexpressAccount]), ProductModule],
  controllers: [AliexpressController, AliexpressStoreProductsController],
  providers: [AliexpressService],
})
export class AliexpressModule {}
