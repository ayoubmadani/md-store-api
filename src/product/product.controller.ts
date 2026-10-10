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
  getStats(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @GetUser() user: any,
  ) {
    return this.productService.getStoreStats(storeId, this.getUserId(user),);
  }

  // ==================== إحصائيات منتج واحد ====================

  @Get(':id/analytics')
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
  restore(
    @Param('id') id: string,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @GetUser() user: any,
  ) {
    return this.productService.restore(id, storeId, this.getUserId(user),);
  }
}