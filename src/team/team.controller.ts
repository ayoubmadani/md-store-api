import {
  Body, Controller, Delete, Get, Headers, HttpCode, HttpStatus, Injectable, Param, ParseUUIDPipe, Patch, Post, Query, Req,
  UnauthorizedException, UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { TeamService } from './team.service';
import { ActivityService } from './activity.service';
import { OwnerOnly } from './guards/store-access.decorator';
import { StoreAccess } from './guards/store-access.guard';
import { AuthGuard } from '../auth/guard/auth.guard';
import { GetUser } from '../user/decorator/get-user.decorator';
import {
  ActivityQueryDto, ChangeMemberGroupDto, CreateGroupDto, ImportGroupDto, InviteMemberDto, RestoreActivityDto,
  SetMemberSuspensionDto, UpdateGroupDto, UserLookupDto,
} from './dto/team.dto';
import { TeamCleanupService } from './team-cleanup.service';

const uid = (user: any): string => user?.actorId || user?.id || user?.sub;
const access = (req: any): StoreAccess => req.storeAccess;

// حد الطلبات لكل مستخدم (لا لكل IP) — للبحث عن المستخدمين
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    return req.storeAccess?.actorId || req.user?.id || req.ip;
  }
}

// ══════════════════════ فريق المتجر (للمالك) ══════════════════════
@Controller('stores/:storeId')
export class StoreTeamController {
  constructor(private readonly team: TeamService, private readonly activity: ActivityService) {}

  // ── المجموعات ──
  @Get('groups')
  @OwnerOnly()
  listGroups(@Param('storeId', ParseUUIDPipe) storeId: string) {
    return this.team.listGroups(storeId);
  }

  @Post('groups')
  @OwnerOnly()
  createGroup(@Param('storeId', ParseUUIDPipe) storeId: string, @Body() dto: CreateGroupDto, @Req() req: any) {
    return this.team.createGroup(storeId, dto, access(req).actorId);
  }

  @Post('groups/import')
  @OwnerOnly()
  importGroup(@Param('storeId', ParseUUIDPipe) storeId: string, @Body() dto: ImportGroupDto, @Req() req: any) {
    return this.team.importGroup(storeId, access(req).ownerId, dto, access(req).actorId);
  }

  @Patch('groups/:groupId')
  @OwnerOnly()
  updateGroup(@Param('storeId', ParseUUIDPipe) storeId: string, @Param('groupId', ParseUUIDPipe) groupId: string, @Body() dto: UpdateGroupDto, @Req() req: any) {
    return this.team.updateGroup(storeId, groupId, dto, access(req).actorId);
  }

  @Patch('groups/:groupId/toggle')
  @OwnerOnly()
  toggleGroup(@Param('storeId', ParseUUIDPipe) storeId: string, @Param('groupId', ParseUUIDPipe) groupId: string, @Req() req: any) {
    return this.team.toggleGroup(storeId, groupId, access(req).actorId);
  }

  @Delete('groups/:groupId')
  @OwnerOnly()
  deleteGroup(@Param('storeId', ParseUUIDPipe) storeId: string, @Param('groupId', ParseUUIDPipe) groupId: string, @Req() req: any) {
    return this.team.deleteGroup(storeId, groupId, access(req).actorId);
  }

  // ── الأعضاء ──
  // UserThrottlerGuard فوق OwnerOnly حتى يعمل بعد المصادقة (يحسب لكل مستخدم)
  @Get('team/user-lookup')
  @UseGuards(UserThrottlerGuard)
  @OwnerOnly()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  userLookup(@Param('storeId', ParseUUIDPipe) storeId: string, @Query() q: UserLookupDto, @Req() req: any) {
    return this.team.userLookup(storeId, access(req).ownerId, q.q);
  }

  @Get('team/limits')
  @OwnerOnly()
  limits(@Req() req: any) {
    return this.team.limits(access(req).ownerId);
  }

  @Get('members')
  @OwnerOnly()
  listMembers(@Param('storeId', ParseUUIDPipe) storeId: string) {
    return this.team.listMembers(storeId);
  }

  @Post('members/invite')
  @OwnerOnly()
  invite(@Param('storeId', ParseUUIDPipe) storeId: string, @Body() dto: InviteMemberDto, @Req() req: any) {
    return this.team.invite(storeId, access(req).ownerId, dto, access(req).actorId);
  }

  @Patch('members/:memberId')
  @OwnerOnly()
  changeGroup(@Param('storeId', ParseUUIDPipe) storeId: string, @Param('memberId', ParseUUIDPipe) memberId: string, @Body() dto: ChangeMemberGroupDto, @Req() req: any) {
    return this.team.changeGroup(storeId, memberId, dto, access(req).actorId);
  }

  // تبديل ضمن حد الخطة: تعليق عضو / إعادة تفعيله
  @Patch('members/:memberId/suspension')
  @OwnerOnly()
  setSuspension(@Param('storeId', ParseUUIDPipe) storeId: string, @Param('memberId', ParseUUIDPipe) memberId: string, @Body() dto: SetMemberSuspensionDto, @Req() req: any) {
    return this.team.setSuspension(storeId, access(req).ownerId, memberId, dto.suspended, access(req).actorId);
  }

  @Delete('members/:memberId')
  @OwnerOnly()
  removeMember(@Param('storeId', ParseUUIDPipe) storeId: string, @Param('memberId', ParseUUIDPipe) memberId: string, @Req() req: any) {
    return this.team.removeMember(storeId, memberId, access(req).actorId);
  }

  // العضو يغادر المتجر (ليس للمالك)
  @Post('leave')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  leave(@Param('storeId', ParseUUIDPipe) storeId: string, @GetUser() user: any) {
    return this.team.leave(storeId, uid(user));
  }

  // ── سجل النشاط ──
  @Get('activity')
  @OwnerOnly()
  activityLog(@Param('storeId', ParseUUIDPipe) storeId: string, @Query() q: ActivityQueryDto) {
    return this.activity.list(storeId, q);
  }

  @Post('activity/:id/restore')
  @HttpCode(HttpStatus.OK)
  @OwnerOnly()
  restore(@Param('storeId', ParseUUIDPipe) storeId: string, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RestoreActivityDto, @Req() req: any) {
    return this.activity.restore(storeId, id, access(req).actorId, !!dto?.force);
  }
}

// ══════════════════════ دعوات المستخدم ══════════════════════
@Controller()
@UseGuards(AuthGuard)
export class InvitationsController {
  constructor(private readonly team: TeamService) {}

  @Get('me/invitations')
  mine(@GetUser() user: any) {
    return this.team.myInvitations(uid(user));
  }

  @Post('invitations/:id/accept')
  @HttpCode(HttpStatus.OK)
  accept(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: any) {
    return this.team.accept(id, uid(user));
  }

  @Post('invitations/:id/reject')
  @HttpCode(HttpStatus.OK)
  reject(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: any) {
    return this.team.reject(id, uid(user));
  }
}

// ══════════════════════ تنظيف يومي (Vercel Cron) ══════════════════════
// Vercel Cron يرسل GET مع Authorization: Bearer <CRON_SECRET>؛ ونقبل POST مع x-cron-secret للاستدعاء اليدوي
@Controller('cron')
export class TeamCronController {
  constructor(private readonly cleanup: TeamCleanupService, private readonly config: ConfigService) {}

  private check(auth?: string, header?: string) {
    const secret = this.config.get<string>('CRON_SECRET');
    if (!secret || (auth !== `Bearer ${secret}` && header !== secret)) throw new UnauthorizedException();
  }

  @Get('cleanup-activity')
  runGet(@Headers('authorization') auth?: string, @Headers('x-cron-secret') header?: string) {
    this.check(auth, header);
    return this.cleanup.run();
  }

  @Post('cleanup-activity')
  @HttpCode(HttpStatus.OK)
  runPost(@Headers('authorization') auth?: string, @Headers('x-cron-secret') header?: string) {
    this.check(auth, header);
    return this.cleanup.run();
  }
}

