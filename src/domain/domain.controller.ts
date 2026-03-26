import { Controller, Get, Post, Body, Param, Delete, UseGuards, Patch } from '@nestjs/common';
import { DomainService } from './domain.service';
import { CreateDomainDto } from './dto/create-domain.dto';
import { AuthGuard } from '../auth/guard/auth.guard';

@Controller('domain')
@UseGuards(AuthGuard)
export class DomainController {
  constructor(private readonly domainService: DomainService) {}

  // 1. إنشاء دومين جديد (يربطه بالمتجر ويطلبه من Cloudflare)
  @Post()
  create(@Body() createDomainDto: CreateDomainDto) {
    return this.domainService.create(createDomainDto);
  }

  // 2. جلب جميع الدومينات الخاصة بمتجر معين
  @Get('store/:storeId')
  findAllWithStore(@Param('storeId') storeId: string) {
    return this.domainService.findAllWithStore(storeId);
  }

  // 3. جلب تعليمات الربط (CNAME و TXT) لكي يراها العميل في لوحة التحكم
  @Get('setup-instructions/:id')
  getConnectionInstructions(@Param('id') id: string) {
    return this.domainService.getConnectionInstructions(id);
  }

  // 4. زر "تحديث الحالة" - يفحص Cloudflare ويحدث isActive في قاعدة البيانات
  @Patch('sync/:id')
  syncStatus(@Param('id') id: string) {
    return this.domainService.syncDomainStatus(id);
  }

  // 5. فحص الحالة مباشرة من Cloudflare (للمسؤولين أو للتأكد التقني)
  @Get('cloudflare-status/:hostname')
  getStatusFromCloudflare(@Param('hostname') hostname: string) {
    return this.domainService.getStatusFromCloudflare(hostname);
  }

  // 6. حذف الدومين من قاعدة البيانات ومن Cloudflare
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.domainService.remove(id);
  }
}