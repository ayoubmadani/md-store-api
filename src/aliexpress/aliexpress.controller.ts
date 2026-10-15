import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, Res, UseGuards } from '@nestjs/common';
import { AllowApiKey } from '../auth/decorator/allow-api-key.decorator';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '../auth/guard/auth.guard';
import { GetUser } from '../user/decorator/get-user.decorator';
import { AliexpressService } from './aliexpress.service';
import { SuperAdminGuard } from '../admin/guard/super-admin.guard';
import { RequirePermission } from '../team/guards/store-access.decorator';
import { StorePermission } from '../team/permissions';
import { LogActivity } from '../team/activity.interceptor';

@Controller('aliexpress')
export class AliexpressController {
  constructor(private readonly ali: AliexpressService, private readonly config: ConfigService) {}

  private getUserId(user: any): string {
    const userId = user?.id || user?.sub;
    if (!userId) throw new BadRequestException('User ID not found in token');
    return userId;
  }

  @Get('status')
  @UseGuards(AuthGuard)
  status(@GetUser() user: any) {
    return this.ali.status(this.getUserId(user));
  }

  // يعود إليه AliExpress بعد الموافقة (Callback URL المسجّل في App Console).
  // الربط يُفتح من لوحة الأدمن في نافذة جديدة ← صفحة نتيجة تُغلق نفسها وتُبلغ اللوحة
  @Get('callback')
  async callback(@Query('code') code: string, @Query('state') state: string, @Res() res: any) {
    let ok = true;
    let message = 'تم ربط حساب AliExpress للمنصة بنجاح';
    try {
      await this.ali.handleCallback(code, state);
    } catch (e: any) {
      ok = false;
      message = e?.message || 'تعذر ربط حساب AliExpress';
    }
    const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
    res.status(ok ? 200 : 400).type('html').send(`<!doctype html><html dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AliExpress</title></head>
<body style="font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f8fafc">
<div style="text-align:center;padding:24px"><div style="font-size:44px">${ok ? '✅' : '❌'}</div><p style="font-size:17px;font-weight:700;color:${ok ? '#047857' : '#b91c1c'}">${esc(message)}</p><p style="color:#64748b;font-size:13px">يمكنك إغلاق هذه النافذة والعودة للوحة الأدمن</p></div>
<script>try{window.opener&&window.opener.postMessage({type:'aliexpress-connect',ok:${ok}},'*')}catch(e){}${ok ? 'setTimeout(function(){window.close()},1500)' : ''}</script>
</body></html>`);
  }

  @Post('import')
  @UseGuards(AuthGuard)
  importProduct(@GetUser() user: any, @Body() body: { url?: string; language?: string }) {
    return this.ali.importProduct(this.getUserId(user), body?.url || '', body?.language);
  }

  // المنتجات المجلوبة التي لم تُحفظ بعد (ألغى التاجر أو فشل الحفظ) — إعادة فتحها لا تُحسب من الحد
  @Get('imports')
  @UseGuards(AuthGuard)
  savedImports(@GetUser() user: any) {
    return this.ali.savedImports(this.getUserId(user));
  }

  @Get('imports/:id')
  @UseGuards(AuthGuard)
  savedImport(@GetUser() user: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.ali.savedImport(this.getUserId(user), id);
  }

  @Delete('imports/:id')
  @UseGuards(AuthGuard)
  dismissImport(@GetUser() user: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.ali.dismissImport(this.getUserId(user), id);
  }

  @Post('imports/:id/used')
  @UseGuards(AuthGuard)
  markImportUsed(@GetUser() user: any, @Param('id', ParseUUIDPipe) id: string, @Body() body: { productId?: string }) {
    return this.ali.markImportUsed(this.getUserId(user), id, body?.productId);
  }
}

// ربط حساب AliExpress للمنصة وإلغاؤه — من لوحة الأدمن فقط
@Controller('admin/aliexpress')
@UseGuards(SuperAdminGuard)
export class AdminAliexpressController {
  constructor(private readonly ali: AliexpressService) {}

  @Get()
  status() {
    return this.ali.adminStatus();
  }

  // رابط صفحة موافقة AliExpress — اللوحة تفتحه في نافذة جديدة
  @Get('connect')
  connect() {
    return { url: this.ali.authorizeUrl() };
  }

  @Delete('connect')
  disconnect() {
    return this.ali.adminDisconnect();
  }
}

// إنشاء منتج من رابط AliExpress في خطوة واحدة — متاح بمفتاح API (Claude عبر MCP)
@Controller('stores/:storeId/products')
@UseGuards(AuthGuard)
export class AliexpressStoreProductsController {
  constructor(private readonly ali: AliexpressService) {}

  @Post('import-aliexpress')
  @AllowApiKey()
  // عضو الفريق بصلاحية المنتجات — يستعمل ربط AliExpress الخاص بالمالك
  @RequirePermission(StorePermission.PRODUCT_CRUD)
  @LogActivity('product', 'create', { response: true })
  importToStore(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @GetUser() user: any,
    @Body() body: { url?: string; price?: number; stock?: number; name?: string; language?: string },
  ) {
    const userId = user?.id || user?.sub;
    if (!userId) throw new BadRequestException('User ID not found in token');
    if (!body?.url) throw new BadRequestException('رابط المنتج مطلوب');
    return this.ali.createProductFromUrl(userId, storeId, {
      url: body.url,
      price: Number(body.price),
      stock: body.stock !== undefined ? Number(body.stock) : undefined,
      name: body.name,
      language: body.language,
    }, user?.actorId);
  }
}
