import { Body, Controller, Get, Headers, Param, ParseUUIDPipe, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AuthGuard } from '../auth/guard/auth.guard';
import { GetUser } from '../user/decorator/get-user.decorator';
import { SuperAdminGuard } from '../admin/guard/super-admin.guard';
import { CustomThemeService } from './custom-theme.service';

class CreateCustomThemeDto {
  @IsUUID()
  storeId: string;

  @IsString() @MinLength(10) @MaxLength(3000)
  request: string;
}

class RevisionDto {
  @IsString() @MinLength(5) @MaxLength(3000)
  request: string;
}

class BuyRevisionsDto {
  @IsInt() @Min(1) @Max(20)
  count: number;
}

class RejectDto {
  @IsOptional() @IsString() @MaxLength(500)
  reason?: string;
}

const userIdOf = (user: any): string => user.id || user.sub;

// التاجر (لوحة التحكم، توكن الدخول — ليس مفتاح API): ثيم خاص تصنعه المنصة بـ Claude
@Controller('custom-themes')
@UseGuards(AuthGuard)
export class CustomThemeController {
  constructor(private readonly service: CustomThemeService) { }

  @Get('config')
  config() {
    return this.service.config();
  }

  @Get()
  list(@GetUser() user: any) {
    return this.service.listMine(userIdOf(user));
  }

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  create(@GetUser() user: any, @Body() dto: CreateCustomThemeDto) {
    return this.service.create(userIdOf(user), dto.storeId, dto.request);
  }

  @Post(':id/revisions')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  revise(@GetUser() user: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RevisionDto) {
    return this.service.requestRevision(userIdOf(user), id, dto.request);
  }

  @Post(':id/buy-revisions')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  buy(@GetUser() user: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: BuyRevisionsDto) {
    return this.service.buyRevisions(userIdOf(user), id, dto.count);
  }
}

// مدير المنصة: مراجعة الطلبات خلال مدة الانتظار — نشر فوري أو رفض (يُسترجع المبلغ)
@Controller('admin/custom-themes')
@UseGuards(SuperAdminGuard)
export class AdminCustomThemeController {
  constructor(private readonly service: CustomThemeService) { }

  @Get()
  list() {
    return this.service.adminList();
  }

  @Post('jobs/:id/approve')
  approve(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.approve(id);
  }

  @Post('jobs/:id/reject')
  reject(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RejectDto) {
    return this.service.reject(id, dto.reason);
  }
}

// Vercel Cron (مرة يومياً على Hobby) — المزامنة تحدث أيضاً كلما فتح التاجر أو الأدمن الصفحة
@Controller('internal/cron')
export class CustomThemeCronController {
  constructor(private readonly service: CustomThemeService, private readonly config: ConfigService) { }

  @Get('custom-themes')
  run(@Headers('authorization') auth?: string) {
    const secret = this.config.get<string>('CRON_SECRET');
    if (!secret || auth !== `Bearer ${secret}`) throw new UnauthorizedException();
    return this.service.syncAll();
  }
}
