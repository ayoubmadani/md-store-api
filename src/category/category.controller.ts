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
import { AuthGuard } from '../auth/guard/auth.guard';
import { QueryProductsDto } from './dto/query-products.dto';
import { GetUser } from '../user/decorator/get-user.decorator';
import { AllowApiKey } from '../auth/decorator/allow-api-key.decorator';
import { OwnerOnly, RequirePermission } from '../team/guards/store-access.decorator';
import { StorePermission } from '../team/permissions';
import { LogActivity } from '../team/activity.interceptor';

@Controller('stores/:storeId/categories')
@UseGuards(AuthGuard)
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  private extractUserId(user: any): string {
    const userId = user.userId || user.sub || user.id;
    if (!userId) throw new BadRequestException('معرف المستخدم غير موجود في التوكن');
    return userId;
  }

  @Post()
  @RequirePermission(StorePermission.CATEGORY_CRUD)
  @LogActivity('category', 'create', { response: true })
  @AllowApiKey()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: CreateCategoryDto,
    @GetUser() user: any,
  ) {
    return this.categoryService.create(storeId, this.extractUserId(user), dto);
  }

  @Get()
  @RequirePermission(StorePermission.CATEGORY_CRUD)
  @AllowApiKey()
  findAll(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @GetUser() user: any,
  ) {
    return this.categoryService.findTrees(storeId, this.extractUserId(user));
  }

  @Get('search')
  @RequirePermission(StorePermission.CATEGORY_CRUD)
  search(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Query('q') searchTerm: string,
    @GetUser() user: any,
  ) {
    return this.categoryService.search(storeId, this.extractUserId(user), searchTerm);
  }

  @Get(':id')
  @RequirePermission(StorePermission.CATEGORY_CRUD)
  @AllowApiKey()
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @GetUser() user: any,
  ) {
    return this.categoryService.findOne(id, storeId, this.extractUserId(user));
  }

  @Get(':id/stats')
  @RequirePermission(StorePermission.CATEGORY_CRUD)
  getStats(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @GetUser() user: any,
  ) {
    return this.categoryService.getStats(id, storeId, this.extractUserId(user));
  }

  @Get(':id/products')
  @RequirePermission(StorePermission.CATEGORY_CRUD)
  getCategoryProducts(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Query() query: QueryProductsDto,
    @GetUser() user: any,
  ) {
    return this.categoryService.getCategoryProductsRecursive(
      id, storeId, this.extractUserId(user), query,
    );
  }

  @Patch(':id')
  @RequirePermission(StorePermission.CATEGORY_CRUD)
  @LogActivity('category', 'update', { param: 'id' })
  @AllowApiKey()
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: UpdateCategoryDto,
    @GetUser() user: any,
  ) {
    return this.categoryService.update(id, storeId, this.extractUserId(user), dto);
  }

  @Patch(':id/move-products')
  @RequirePermission(StorePermission.CATEGORY_CRUD)
  moveProducts(
    @Param('id', ParseUUIDPipe) fromCategoryId: string,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body('toCategoryId', ParseUUIDPipe) toCategoryId: string,
    @GetUser() user: any,
  ) {
    return this.categoryService.moveProducts(
      fromCategoryId, toCategoryId, storeId, this.extractUserId(user),
    );
  }

  @Patch(':id/restore')
  @RequirePermission(StorePermission.CATEGORY_CRUD)
  @LogActivity('category', 'restore', { param: 'id' })
  restore(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @GetUser() user: any,
  ) {
    return this.categoryService.restore(id, storeId, this.extractUserId(user));
  }

  @Delete(':id')
  @RequirePermission(StorePermission.CATEGORY_CRUD)
  @LogActivity('category', 'delete', { param: 'id' })
  @AllowApiKey()
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @GetUser() user: any,
  ) {
    return this.categoryService.remove(id, storeId, this.extractUserId(user));
  }

  @Delete(':id/force')
  @OwnerOnly()
  @LogActivity('category', 'delete', { param: 'id' })
  @HttpCode(HttpStatus.OK)
  forceRemove(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @GetUser() user: any,
  ) {
    return this.categoryService.forceRemove(id, storeId, this.extractUserId(user));
  }
}