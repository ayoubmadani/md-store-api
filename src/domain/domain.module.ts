import { Module } from '@nestjs/common';
import { DomainService } from './domain.service';
import { DomainController, PublicDomainController } from './domain.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Domain } from './entities/domain.entity';
import { Store } from '../store/entities/store.entity';
import { BuilderPage } from '../builder-pages/entities/builder-page.entity';
import { SubscriptionModule } from '../subscription/subscription.module';

@Module({
  controllers: [DomainController, PublicDomainController],
  providers: [DomainService],
  exports: [DomainService],
  imports:[
    TypeOrmModule.forFeature([Domain , Store, BuilderPage]),
    SubscriptionModule,
  ]
})
export class DomainModule {}
