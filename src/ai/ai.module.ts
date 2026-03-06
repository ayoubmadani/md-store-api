import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../product/entities/product.entity';

@Module({
  providers: [AiService],
  controllers: [AiController],
  exports: [AiService],
  imports: [
    TypeOrmModule.forFeature([Product])
  ],
})
export class AiModule {}
