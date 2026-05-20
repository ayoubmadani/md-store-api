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
    @GetUser() user: any,
  ) {
    return this.categoryService.findTrees(storeId, this.extractUserId(user));
  }

  @Get('search')
  search(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Query('q') searchTerm: string,
    @GetUser() user: any,
  ) {
    return this.categoryService.search(storeId, this.extractUserId(user), searchTerm);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @GetUser() user: any,
  ) {
    return this.categoryService.findOne(id, storeId, this.extractUserId(user));
  }

  @Get(':id/stats')
  getStats(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @GetUser() user: any,
  ) {
    return this.categoryService.getStats(id, storeId, this.extractUserId(user));
  }

  @Get(':id/products')
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
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Body() dto: UpdateCategoryDto,
    @GetUser() user: any,
  ) {
    return this.categoryService.update(id, storeId, this.extractUserId(user), dto);
  }

  @Patch(':id/move-products')
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
  restore(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @GetUser() user: any,
  ) {
    return this.categoryService.restore(id, storeId, this.extractUserId(user));
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

  @Delete(':id/force')
  @HttpCode(HttpStatus.OK)
  forceRemove(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @GetUser() user: any,
  ) {
    return this.categoryService.forceRemove(id, storeId, this.extractUserId(user));
  }
}