import { Module } from '@nestjs/common';
import { LandingPageService } from './landing-page.service';
import { LandingPageController } from './landing-page.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LandingPage } from './entities/landing-page.entity';
import { AiModule } from 'src/ai/ai.module';
import { ImageGeneratorService } from 'src/image-generator/image-generator.service';

@Module({
  controllers: [LandingPageController],
  providers: [
    LandingPageService,
    ImageGeneratorService, // 👈
  ],
  imports: [
    TypeOrmModule.forFeature([LandingPage]),
    AiModule,
  ],
})
export class LandingPageModule {}