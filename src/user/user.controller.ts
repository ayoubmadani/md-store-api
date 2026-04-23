import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, BadRequestException, Query } from '@nestjs/common';
import { UserService } from './user.service';
import { AuthGuard } from '../auth/guard/auth.guard';
import { GetUser } from './decorator/get-user.decorator';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) { }

  @Get('current-user')
  @UseGuards(AuthGuard)
  currentUser(@GetUser() user: any) {
    // استخدم user.sub إذا كان التوكن يحتوي على sub
    const userId = user.id || user.sub;
    if (!userId) throw new BadRequestException('User ID not found in token');
    return this.userService.findUserById(userId);
  }

  @Patch()
  @UseGuards(AuthGuard)
  update(
    @GetUser() user: any,
    @Body() dto: any
  ) {
    const userId = user.id || user.sub;
    return this.userService.updateUser(dto, userId)
  }

  @Post('toggle-ntfy')
  @UseGuards(AuthGuard)
  toggleNtfy(
    @GetUser() user: any,
  ) {
    const userId = user.id || user.sub;
    return this.userService.toggleNtfy(userId)
  }

  @Post('init-sub')
  @UseGuards(AuthGuard)
  initSub(@GetUser() user: any,) {
    const userId = user.id || user.sub;
    return this.userService.initSub(userId)

  }

  @Post('contact-user/message')
  createMessage(
    @Body() dto: any
  ) {
    return this.userService.createMessage(dto)
  }

  @Get('message-user')
  @UseGuards(AuthGuard)
  getMessages(
    @GetUser() user: any,
    @Query() dto: { filter?: string, archive?: string, viewed?: string , noVirwd?:string},
    @Query('nb') nb?: string,
  ) {
    const userId = user.id || user.sub;
    // نمرر الـ dto بالكامل الذي يحتوي على الفلاتر
    return this.userService.getMessages(userId, nb, dto);
  }

  // إضافة المسارات (Endpoints) لتحديث الحالة
  @Patch('message-user/:id/view')
  @UseGuards(AuthGuard)
  markAsViewed(@Param('id') id: string) {
    return this.userService.markAsViewed(id);
  }

  @Patch('message-user/:id/archive')
  @UseGuards(AuthGuard)
  toggleArchive(
    @Param('id') id: string,
    @Query('state') state: string // true أو false
  ) {
    return this.userService.toggleArchive(id, state === 'true');
  }

  @Delete('message-user/:id')
  @UseGuards(AuthGuard)
  deleteMessage(@Param('id') id: string) {
    return this.userService.deleteMessage(id);
  }



}
