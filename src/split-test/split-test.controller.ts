import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SplitTestService } from './split-test.service';
import { CreateSplitTestDto, SetWinnerDto, UpdateSplitTestDto } from './dto/split-test.dto';
import { AuthGuard } from '../auth/guard/auth.guard';
import { AllowApiKey } from '../auth/decorator/allow-api-key.decorator';
import { GetUser } from '../user/decorator/get-user.decorator';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// اختبارات A/B لصفحات الهبوط
@Controller('split-tests')
export class SplitTestController {
  constructor(private readonly service: SplitTestService) {}

  private uid(user: any): string {
    const id = user?.id || user?.sub;
    if (!id) throw new BadRequestException('User ID not found in token');
    return id;
  }

  // عام — المتجر: دومين الاختبار ← صفحة للزائر. v = الصفحة التي رآها الزائر من قبل (للثبات)
  @Get('resolve')
  resolve(@Query('id') id?: string, @Query('v') v?: string, @Query('preview') preview?: string) {
    if (!id || !UUID.test(id)) throw new BadRequestException('id مطلوب');
    const n = preview && /^[1-3]$/.test(preview) ? Number(preview) : undefined;
    return this.service.resolve(id, v && UUID.test(v) ? v : undefined, n);
  }

  @Get()
  @AllowApiKey()
  @UseGuards(AuthGuard)
  list(@Query('storeId', ParseUUIDPipe) storeId: string, @GetUser() user: any) {
    return this.service.list(storeId, this.uid(user));
  }

  @Post()
  @AllowApiKey()
  @UseGuards(AuthGuard)
  create(@Body() dto: CreateSplitTestDto, @GetUser() user: any) {
    return this.service.create(dto, this.uid(user));
  }

  @Get(':id/stats')
  @AllowApiKey()
  @UseGuards(AuthGuard)
  stats(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: any) {
    return this.service.stats(id, this.uid(user));
  }

  @Patch(':id')
  @AllowApiKey()
  @UseGuards(AuthGuard)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSplitTestDto, @GetUser() user: any) {
    return this.service.update(id, dto, this.uid(user));
  }

  @Post(':id/winner')
  @AllowApiKey()
  @UseGuards(AuthGuard)
  setWinner(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetWinnerDto, @GetUser() user: any) {
    return this.service.setWinner(id, dto.builderPageId, this.uid(user));
  }

  @Delete(':id')
  @AllowApiKey()
  @UseGuards(AuthGuard)
  remove(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: any) {
    return this.service.remove(id, this.uid(user));
  }
}
