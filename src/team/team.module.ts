import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StoreGroup } from './entities/store-group.entity';
import { StoreMember } from './entities/store-member.entity';
import { StoreActivity } from './entities/store-activity.entity';
import { Store } from '../store/entities/store.entity';
import { TeamService } from './team.service';
import { ActivityService } from './activity.service';
import { ActivityInterceptor } from './activity.interceptor';
import { TeamCleanupService } from './team-cleanup.service';
import { StoreAccessGuard } from './guards/store-access.guard';
import { InvitationsController, StoreTeamController, TeamCronController, UserThrottlerGuard } from './team.controller';
import { DomainModule } from '../domain/domain.module';

// Global: الحارس والـ interceptor وخدمة السجل تُستعمل في مسارات كل الموديولات (منتجات، تصنيفات، طلبات…)
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([StoreGroup, StoreMember, StoreActivity, Store]), DomainModule],
  controllers: [StoreTeamController, InvitationsController, TeamCronController],
  providers: [TeamService, ActivityService, ActivityInterceptor, TeamCleanupService, StoreAccessGuard, UserThrottlerGuard],
  exports: [TeamService, ActivityService, ActivityInterceptor, StoreAccessGuard],
})
export class TeamModule {}
