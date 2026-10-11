import { Controller, Get, Post, Body, Param, UseGuards, Patch, ParseUUIDPipe } from '@nestjs/common';
import { DomainService } from './domain.service';
import { CreateDomainDto } from './dto/create-domain.dto';
import { AuthGuard } from '../auth/guard/auth.guard';
import { AllowApiKey } from '../auth/decorator/allow-api-key.decorator';
import { GetUser } from '../user/decorator/get-user.decorator';

const userIdOf = (user: any): string => user.id || user.sub || user.userId;

@Controller('domain')
@UseGuards(AuthGuard)
export class DomainController {
  constructor(private readonly domainService: DomainService) {}

  // 1. إضافة دومين جديد لمتجر التاجر (يربطه بـ Vercel ويحفظه في DB)
  @Post()
  @AllowApiKey()
  async create(@Body() createDomainDto: CreateDomainDto, @GetUser() user: any) {
    await this.domainService.verifyStoreOwner(createDomainDto.storeId, userIdOf(user));
    return this.domainService.create(createDomainDto);
  }

  // 2. جلب جميع الدومينات المربوطة بمتجر معين (لعرضها في الجدول)
  @Get('store/:storeId')
  @AllowApiKey()
  async findAllWithStore(@Param('storeId', ParseUUIDPipe) storeId: string, @GetUser() user: any) {
    await this.domainService.verifyStoreOwner(storeId, userIdOf(user));
    return this.domainService.findAllWithStore(storeId);
  }

  // 3. جلب بيانات الـ DNS (A Record و CNAME) ليقوم العميل بوضعها في Namecheap
  @Get('setup-instructions/:domain')
  @AllowApiKey()
  getConnectionInstructions(@Param('domain') domain: string) {
    return this.domainService.getConnectionInstructions(domain);
  }

  // 4. زر "تحديث الحالة" - يفحص Vercel الآن ويحدث isActive إذا اكتمل الربط
  @Patch('sync/:id')
  @AllowApiKey()
  syncStatus(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: any) {
    return this.domainService.syncDomainStatus(id, userIdOf(user));
  }

  // 5. فحص الحالة التقنية مباشرة من Vercel (للتحقق من الـ SSL والـ DNS)
  @Get('vercel-status/:hostname')
  getVercelStatus(@Param('hostname') hostname: string) {
    // قمنا بتغيير اسم الدالة لتعبر عن Vercel بدلاً من Cloudflare
    return this.domainService.getVercelDomainStatus(hostname);
  }

  // 6. حذف الدومين نهائياً (من قاعدة بياناتك ومن مشروع Vercel)
  @Post('delete/:id')
  @AllowApiKey()
  async remove(@Param('id', ParseUUIDPipe) id: string, @Body('storeId', ParseUUIDPipe) storeId: string, @GetUser() user: any) {
    await this.domainService.verifyStoreOwner(storeId, userIdOf(user));
    return this.domainService.remove(id, storeId);
  }

  // 7. تخصيص دومين موجود (تم إنشاؤه من صفحة الدومين) لصفحة هبوط واحدة — يُستدعى
  // من داخل المحرر بعد اختيار الدومين من القائمة.
  @Patch(':id/assign-page')
  @AllowApiKey()
  async assignToBuilderPage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { builderPageId: string; storeId: string },
    @GetUser() user: any,
  ) {
    await this.domainService.verifyStoreOwner(dto.storeId, userIdOf(user));
    return this.domainService.assignToBuilderPage(id, dto.builderPageId, dto.storeId);
  }

  // 8. فك الربط — يُعيد الدومين ليصبح دومين متجر عادي (scope: store) بدل حذفه.
  @Patch(':id/unassign-page')
  @AllowApiKey()
  async unassignFromBuilderPage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('storeId', ParseUUIDPipe) storeId: string,
    @GetUser() user: any,
  ) {
    await this.domainService.verifyStoreOwner(storeId, userIdOf(user));
    return this.domainService.unassignFromBuilderPage(id, storeId);
  }
}

// عام (بدون تسجيل دخول) — يستعمله المتجر لمعرفة ما يعرضه على الدومين
@Controller('domain')
export class PublicDomainController {
  constructor(private readonly domainService: DomainService) {}

  @Get('resolve/:domain')
  resolve(@Param('domain') domain: string) {
    return this.domainService.resolve(domain);
  }
}
