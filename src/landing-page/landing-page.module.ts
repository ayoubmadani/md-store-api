import { Module } from '@nestjs/common';
import { LandingPageService } from './landing-page.service';
import { LandingPageController } from './landing-page.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LandingPage } from './entities/landing-page.entity';
import { AiModule } from '../ai/ai.module';

@Module({
  controllers: [LandingPageController],
  providers: [
    LandingPageService,
  ],
  imports: [
    TypeOrmModule.forFeature([LandingPage]),
    AiModule,
  ],
})
export class LandingPageModule {}