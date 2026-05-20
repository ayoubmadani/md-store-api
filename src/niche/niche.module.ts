import { Module } from '@nestjs/common';
import { NicheService } from './niche.service';
import { NicheController } from './niche.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Niche } from './entities/niche.entity';
import { CategoryNiche } from './entities/category-niche.entity';
import { Store } from 'src/store/entities/store.entity';

@Module({
  controllers: [NicheController],
  providers: [NicheService],
  imports: [
    TypeOrmModule.forFeature([Niche,CategoryNiche,Store])
  ],
})
export class NicheModule {}
