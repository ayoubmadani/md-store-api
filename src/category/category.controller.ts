import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { CategoryService } from './category.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { AuthGuard } from 'src/auth/guard/auth.guard';
import { QueryProductsDto } from './dto/query-products.dto';
import { GetUser } from 'src/user/decorator/get-user.decorator';
// تأكد من استيراد الـ GetUser من مساره الصحيح في مشروعك

@Controller('stores/:storeId/categories')
@UseGuards(AuthGuard)
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  // دالة مساعدة موحدة لاستخراج المعرف
  private extractUserId(user: any): string {
    // بناءً على الـ Token الخاص بك: المعرف غالباً في sub أو userId أو id
    const userId = user.userId || user.sub || user.id;
    if (!userId) {
      throw new BadRequestException('معرف المستخدم غير موجود في التوكن');
    }
    return userId;
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: CreateCategoryDto,
    @GetUser() user: any,
  ) {
    return this.categoryService.create(storeId, this.extractUserId(user), dto);
  }

  @Get()
  findAll(
    @Param('storeId', ParseUUIDPipe) storeId: string, 
    @GetUser() user: any
  ) {
    return this.categoryService.findTrees(storeId, this.extractUserId(user));
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @GetUser() user: any,
  ) {
    return this.categoryService.findOne(id, storeId, this.extractUserId(user));
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: UpdateCategoryDto,
    @GetUser() user: any,
  ) {
    return this.categoryService.update(id, storeId, this.extractUserId(user), dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @GetUser() user: any,
  ) {
    return this.categoryService.remove(id, storeId, this.extractUserId(user));
  }

  // ... طبق نفس النمط (this.extractUserId(user)) على بقية الدوال
}