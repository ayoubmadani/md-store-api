import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';
import { AuthGuard } from '../auth/guard/auth.guard';
import { GetUser } from '../user/decorator/get-user.decorator';
import { RequirePermission } from '../team/guards/store-access.decorator';
import { StorePermission } from '../team/permissions';
import { InventoryService } from './inventory.service';

class AdjustStockDto {
  @IsUUID()
  productId: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  variantDetailId?: string | null;

  // add = توريد (+)، set = جرد: المخزون يصبح هذا الرقم
  @IsIn(['add', 'set'])
  mode: 'add' | 'set';

  @Type(() => Number)
  @IsInt()
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}

class StockSettingsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costPrice?: number | null;
}

@Controller('stores/:storeId/inventory')
@UseGuards(AuthGuard)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) { }

  @Get()
  @RequirePermission(StorePermission.PRODUCT_CRUD)
  overview(@Param('storeId') storeId: string) {
    return this.inventory.overview(storeId);
  }

  @Get('movements')
  @RequirePermission(StorePermission.PRODUCT_CRUD)
  movements(@Param('storeId') storeId: string, @Query('productId') productId?: string, @Query('page') page?: string) {
    return this.inventory.movements(storeId, { productId, page: Number(page) || 1 });
  }

  // مسح الباركود من تطبيق المخزون
  @Get('barcode/:code')
  @RequirePermission(StorePermission.PRODUCT_CRUD)
  barcode(@Param('storeId') storeId: string, @Param('code') code: string) {
    return this.inventory.findByBarcode(storeId, code);
  }

  @Post('adjust')
  @RequirePermission(StorePermission.PRODUCT_CRUD)
  adjust(@Param('storeId') storeId: string, @Body() dto: AdjustStockDto, @GetUser() user: any) {
    return this.inventory.adjust(storeId, String(user?.actorId || user?.id || user?.sub), dto);
  }

  @Patch('products/:productId')
  @RequirePermission(StorePermission.PRODUCT_CRUD)
  settings(@Param('storeId') storeId: string, @Param('productId') productId: string, @Body() dto: StockSettingsDto) {
    return this.inventory.updateSettings(storeId, productId, dto);
  }
}
