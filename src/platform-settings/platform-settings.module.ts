import { Body, Controller, Get, Global, Module, Put, UseGuards } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SuperAdminGuard } from '../admin/guard/super-admin.guard';
import { PlatformSetting } from './platform-setting.entity';
import { PlatformSettingsService } from './platform-settings.service';

@Controller('admin/settings')
@UseGuards(SuperAdminGuard)
export class PlatformSettingsController {
  constructor(private readonly settings: PlatformSettingsService) {}

  @Get()
  get() {
    return this.settings.getAll();
  }

  @Put()
  update(@Body() body: Record<string, unknown>) {
    return this.settings.update(body);
  }
}

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([PlatformSetting])],
  controllers: [PlatformSettingsController],
  providers: [PlatformSettingsService],
  exports: [PlatformSettingsService],
})
export class PlatformSettingsModule {}
