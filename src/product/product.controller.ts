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
import { AuthGuard } from '../auth/guard/auth.guard';
import { GetUser } from '../user/decorator/get-user.decorator';

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

  // ==================== جلب منتج واحد ====================

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @GetUser() user: any,
  ) {
      return this.productService.findOne(id , storeId)
  }

  // ==================== تحديث منتج ====================

  @Patch(':id')
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
  toggleActive(
    @Param('id') id: string,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @GetUser() user: any,
  ) {
    return this.productService.toggleActive(id, storeId, this.getUserId(user),);
  }

  // ==================== تحديث المخزون ====================

  @Patch(':id/stock')
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