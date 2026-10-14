import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SplitTest } from './entities/split-test.entity';
import { SplitTestService } from './split-test.service';
import { SplitTestController } from './split-test.controller';
import { Store } from '../store/entities/store.entity';
import { BuilderPage } from '../builder-pages/entities/builder-page.entity';
import { Domain } from '../domain/entities/domain.entity';
import { BuilderPagesModule } from '../builder-pages/builder-pages.module';
import { DomainModule } from '../domain/domain.module';

@Module({
  imports: [TypeOrmModule.forFeature([SplitTest, Store, BuilderPage, Domain]), BuilderPagesModule, DomainModule],
  providers: [SplitTestService],
  controllers: [SplitTestController],
})
export class SplitTestModule {}
