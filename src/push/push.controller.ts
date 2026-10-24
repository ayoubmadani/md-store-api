import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guard/auth.guard';
import { GetUser } from '../user/decorator/get-user.decorator';
import { PushService } from './push.service';

// الشخص الحقيقي (عضو الفريق إن كان يعمل في متجر غيره) — نفس ما يستعمله رمز الدخول السريع
const personOf = (user: any): string => String(user?.actorId || user?.id || user?.sub);

// إشعارات تطبيق الهاتف (Web Push)
@Controller('push')
@UseGuards(AuthGuard)
export class PushController {
  constructor(private readonly push: PushService) {}

  @Get('vapid')
  vapid() {
    return this.push.publicKey();
  }

  @Post('subscribe')
  @HttpCode(HttpStatus.OK)
  subscribe(@GetUser() user: any, @Body() body: any, @Headers('user-agent') ua?: string) {
    return this.push.subscribe(personOf(user), body, ua);
  }

  @Post('unsubscribe')
  @HttpCode(HttpStatus.OK)
  unsubscribe(@GetUser() user: any, @Body('endpoint') endpoint: string) {
    return this.push.unsubscribe(personOf(user), String(endpoint || ''));
  }
}
