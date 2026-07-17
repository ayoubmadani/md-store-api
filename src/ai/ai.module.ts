import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { AnthropicService } from './anthropic.service';
import { GeminiService } from './gemini.service';
import { ReplicateImageService } from './replicate-image.service';
import { PollinationsImageService } from './pollinations-image.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../product/entities/product.entity';

@Module({
  providers: [AiService, AnthropicService, GeminiService, ReplicateImageService, PollinationsImageService],
  controllers: [AiController],
  exports: [AiService, AnthropicService, GeminiService, ReplicateImageService, PollinationsImageService],
  imports: [
    TypeOrmModule.forFeature([Product])
  ],
})
export class AiModule {}
