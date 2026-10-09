import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guard/auth.guard';
import { GetUser } from '../user/decorator/get-user.decorator';
import { ApiKeyService } from './api-key.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

// بدون @AllowApiKey عمداً — إدارة المفاتيح بالـ JWT فقط، فلا يستطيع
// مفتاح أن ينشئ مفتاحاً آخر أو يلغيه.
@Controller('api-keys')
@UseGuards(AuthGuard)
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  private getUserId(user: any): string {
    const userId = user?.id || user?.sub;
    if (!userId) throw new BadRequestException('User ID not found in token');
    return userId;
  }

  @Post()
  create(@Body() dto: CreateApiKeyDto, @GetUser() user: any) {
    return this.apiKeyService.create(this.getUserId(user), dto);
  }

  @Get()
  findAll(@GetUser() user: any) {
    return this.apiKeyService.findAll(this.getUserId(user));
  }

  @Delete(':id')
  revoke(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: any) {
    return this.apiKeyService.revoke(this.getUserId(user), id);
  }
}
