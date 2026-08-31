import { Module } from '@nestjs/common';
import { DomainService } from './domain.service';
import { DomainController } from './domain.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Domain } from './entities/domain.entity';
import { Store } from '../store/entities/store.entity';
import { BuilderPage } from '../builder-pages/entities/builder-page.entity';

@Module({
  controllers: [DomainController],
  providers: [DomainService],
  imports:[
    TypeOrmModule.forFeature([Domain , Store, BuilderPage])
  ]
})
export class DomainModule {}
