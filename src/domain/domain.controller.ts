import { Controller, Get, Post, Body, Param, Delete, UseGuards, Patch } from '@nestjs/common';
import { DomainService } from './domain.service';
import { CreateDomainDto } from './dto/create-domain.dto';
import { AuthGuard } from '../auth/guard/auth.guard';

@Controller('domain')
@UseGuards(AuthGuard)
export class DomainController {
  constructor(private readonly domainService: DomainService) {}

  // 1. إضافة دومين جديد لمتجر التاجر (يربطه بـ Vercel ويحفظه في DB)
  @Post()
  create(@Body() createDomainDto: CreateDomainDto) {
    return this.domainService.create(createDomainDto);
  }

  // 2. جلب جميع الدومينات المربوطة بمتجر معين (لعرضها في الجدول)
  @Get('store/:storeId')
  findAllWithStore(@Param('storeId') storeId: string) {
    return this.domainService.findAllWithStore(storeId);
  }

  // 3. جلب بيانات الـ DNS (A Record و CNAME) ليقوم العميل بوضعها في Namecheap
  @Get('setup-instructions/:domain')
  getConnectionInstructions(@Param('domain') domain: string) {
    return this.domainService.getConnectionInstructions(domain);
  }

  // 4. زر "تحديث الحالة" - يفحص Vercel الآن ويحدث isActive إذا اكتمل الربط
  @Patch('sync/:id')
  syncStatus(@Param('id') id: string) {
    return this.domainService.syncDomainStatus(id);
  }

  // 5. فحص الحالة التقنية مباشرة من Vercel (للتحقق من الـ SSL والـ DNS)
  @Get('vercel-status/:hostname')
  getVercelStatus(@Param('hostname') hostname: string) {
    // قمنا بتغيير اسم الدالة لتعبر عن Vercel بدلاً من Cloudflare
    return this.domainService.getVercelDomainStatus(hostname);
  }

  // 6. حذف الدومين نهائياً (من قاعدة بياناتك ومن مشروع Vercel)
  @Delete(':id')
  remove(@Param('id') id: string , @Body('storeId') storeId:string) {
    return this.domainService.remove(id,storeId);
  }
}