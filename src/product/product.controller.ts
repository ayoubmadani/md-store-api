import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ParseIntPipe,
  ParseBoolPipe,
  BadRequestException,
} from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { SetAttributeValueActiveDto } from './dto/set-attribute-value-active.dto';
import { UpdateOfferQuickDto, UpdateVariantQuickDto } from './dto/update-product-option.dto';
import { AuthGuard } from '../auth/guard/auth.guard';
import { GetUser } from '../user/decorator/get-user.decorator';
import { AllowApiKey } from '../auth/decorator/allow-api-key.decorator';
import { OwnerOnly, RequirePermission } from '../team/guards/store-access.decorator';
import { StorePermission } from '../team/permissions';
import { LogActivity } from '../team/activity.interceptor';

// ... (الاستيرادات تبقى كما هي)


@Controller('stores/:storeId/products')
@UseGuards(AuthGuard)
export class ProductController {
  constructor(private readonly productService: ProductService) { }

  // دالة مساعدة داخلية لاستخراج المعرف بأمان
  private getUserId(user: any): string {
    const id = user.id || user.sub || user.userId;
    if (!id) throw new BadRequestException('User ID not found in token');
    return id;
  }

  @Post()
  @RequirePermission(StorePermission.PRODUCT_CRUD)
  @LogActivity('product', 'create', { response: true })
  @AllowApiKey()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: CreateProductDto, // سنعيدها CreateProductDto بعد إصلاح الـ Frontend
    @GetUser() user: any
  ) {
    const userId = this.getUserId(user);

    // لاحقاً عند التفعيل:
    return this.productService.create(storeId, userId, dto);
  }

  @Post('multi')
  @RequirePermission(StorePermission.PRODUCT_CRUD)
  @LogActivity('product', 'create', { response: true })
  @HttpCode(HttpStatus.CREATED)
  createMulti(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dtos: CreateProductDto[], // سنعيدها CreateProductDto بعد إصلاح الـ Frontend
    @GetUser() user: any
  ){
    const userId = this.getUserId(user);
    return this.productService.createMulti(storeId, userId, dtos);
  }

  @Get()
  @RequirePermission(StorePermission.PRODUCT_CRUD)
  @AllowApiKey()
  findAll(
    @GetUser() user: any,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('isActive', new ParseBoolPipe({ optional: true })) isActive?: boolean,
    // ✅ توحيد الاستخدام
  ) {
    return this.productService.findAll(
      storeId,
      this.getUserId(user),
      page,
      limit,
      categoryId,
      search,
      isActive
    );
  }

  // ... طبق نفس التغيير على بقية الدوال (استخدام GetUser)
  @Get('stats')
  @RequirePermission(StorePermission.PRODUCT_CRUD)
  getStats(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @GetUser() user: any,
  ) {
    return this.productService.getStoreStats(storeId, this.getUserId(user),);
  }

  // ==================== إحصائيات منتج واحد ====================

  @Get(':id/analytics')
  @RequirePermission(StorePermission.PRODUCT_CRUD)
  getAnalytics(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @GetUser() user: any,
    @Query('days', new ParseIntPipe({ optional: true })) days?: number,
  ) {
    return this.productService.getProductAnalytics(id, storeId, this.getUserId(user), days || undefined);
  }

  // ==================== تفعيل/تعطيل عرض أو متغير ====================

  @Patch(':id/offers/:offerId/toggle-active')
  @RequirePermission(StorePermission.PRODUCT_CRUD)
  toggleOfferActive(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @GetUser() user: any,
  ) {
    return this.productService.toggleOfferActive(id, offerId, storeId, this.getUserId(user));
  }

  // تعطيل/تفعيل قيمة كاملة (مثل اللون الأحمر) في كل تركيباتها
  // — مسار ثابت قبل :variantId حتى لا يُلتقط كمعرّف
  @Patch(':id/variants/attribute-value')
  @RequirePermission(StorePermission.PRODUCT_CRUD)
  setAttributeValueActive(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: SetAttributeValueActiveDto,
    @GetUser() user: any,
  ) {
    return this.productService.setAttributeValueActive(
      id, storeId, this.getUserId(user), dto.attrName, dto.value, dto.isActive,
    );
  }

  @Patch(':id/variants/:variantId/toggle-active')
  @RequirePermission(StorePermission.PRODUCT_CRUD)
  toggleVariantActive(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @GetUser() user: any,
  ) {
    return this.productService.toggleVariantActive(id, variantId, storeId, this.getUserId(user));
  }

  // ==================== تعديل سعر/كمية عرض أو متغير ====================
  // بعد مسار variants/attribute-value حتى لا يُلتقط "attribute-value" كمعرّف

  @Patch(':id/offers/:offerId')
  @RequirePermission(StorePermission.PRODUCT_CRUD)
  updateOffer(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: UpdateOfferQuickDto,
    @GetUser() user: any,
  ) {
    return this.productService.updateOffer(id, offerId, storeId, this.getUserId(user), dto);
  }

  @Patch(':id/variants/:variantId')
  @RequirePermission(StorePermission.PRODUCT_CRUD)
  updateVariant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: UpdateVariantQuickDto,
    @GetUser() user: any,
  ) {
    return this.productService.updateVariant(id, variantId, storeId, this.getUserId(user), dto);
  }

  // ==================== جلب منتج واحد ====================

  @Get(':id')
  @RequirePermission(StorePermission.PRODUCT_CRUD)
  @AllowApiKey()
  findOne(
    @Param('id') id: string,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @GetUser() user: any,
  ) {
      return this.productService.findOne(id , storeId)
  }

  // ==================== تحديث منتج ====================

  @Patch(':id')
  @RequirePermission(StorePermission.PRODUCT_CRUD)
  @LogActivity('product', 'update', { param: 'id' })
  @AllowApiKey()
  update(
    @Param('id') id: string,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: UpdateProductDto,
    @GetUser() user: any,
  ) {
    console.log(dto);
    
    return this.productService.update(id, storeId, this.getUserId(user), dto);
  }

  // ==================== تغيير حالة المنتج ====================

  @Patch(':id/toggle-active')
  @RequirePermission(StorePermission.PRODUCT_CRUD)
  @LogActivity('product', 'update', { param: 'id' })
  @AllowApiKey()
  toggleActive(
    @Param('id') id: string,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @GetUser() user: any,
  ) {
    return this.productService.toggleActive(id, storeId, this.getUserId(user),);
  }

  // ==================== تحديث المخزون ====================

  @Patch(':id/stock')
  @RequirePermission(StorePermission.PRODUCT_CRUD)
  @LogActivity('product', 'update', { param: 'id' })
  @AllowApiKey()
  updateStock(
    @Param('id') id: string,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body('quantity', ParseIntPipe) quantity: number,
    @GetUser() user: any,
  ) {
    
    return this.productService.updateStock(id, storeId, this.getUserId(user), quantity);
  }

  // ==================== حذف منتج (Soft Delete) ====================

  @Delete(':id')
  @RequirePermission(StorePermission.PRODUCT_CRUD)
  @LogActivity('product', 'delete', { param: 'id' })
  @AllowApiKey()
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('id') id: string,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @GetUser() user: any,
  ) {
    return this.productService.remove(id, storeId, this.getUserId(user),);
  }

  // ==================== الحذف النهائي ====================

  @Delete(':id/force')
  @OwnerOnly()
  @LogActivity('product', 'delete', { param: 'id' })
  @HttpCode(HttpStatus.OK)
  forceRemove(
    @Param('id') id: string,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @GetUser() user: any,
  ) {
    return this.productService.forceRemove(id, storeId, this.getUserId(user),);
  }

  // ==================== استعادة منتج محذوف ====================

  @Patch(':id/restore')
  @RequirePermission(StorePermission.PRODUCT_CRUD)
  @LogActivity('product', 'restore', { param: 'id' })
  restore(
    @Param('id') id: string,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @GetUser() user: any,
  ) {
    return this.productService.restore(id, storeId, this.getUserId(user),);
  }
}