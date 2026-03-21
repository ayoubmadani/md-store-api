import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, BadRequestException } from '@nestjs/common';
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

}
