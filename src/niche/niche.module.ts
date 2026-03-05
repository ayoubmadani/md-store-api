import { Module } from '@nestjs/common';
import { NicheService } from './niche.service';
import { NicheController } from './niche.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Niche } from './entities/niche.entity';

@Module({
  controllers: [NicheController],
  providers: [NicheService],
  imports: [
    TypeOrmModule.forFeature([Niche])
  ],
})
export class NicheModule {}
