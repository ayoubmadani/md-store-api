import {
  BadRequestException, Body, Controller, Get, Param, ParseIntPipe, ParseUUIDPipe, Patch, Query, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guard/auth.guard';
import { AllowApiKey } from '../auth/decorator/allow-api-key.decorator';
import { GetUser } from '../user/decorator/get-user.decorator';
import { StoreService } from '../store/store.service';
import { OrdersService } from './order.service';
import { SheetStatusDto } from './dto/sheet-status.dto';

/**
 * مزامنة الطلبات مع Google Sheets عبر Apps Script يلصقه التاجر في ملفه.
 * السكربت يستعمل مفتاح API (mdk_...) — المسارات هنا فقط تقبله، ومحصورة
 * في متاجر صاحب المفتاح.
 */
@Controller('stores/:storeId/sheet-sync')
@UseGuards(AuthGuard)
@AllowApiKey()
export class SheetSyncController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly storeService: StoreService,
  ) {}

  private getUserId(user: any): string {
    const id = user?.id || user?.sub || user?.userId;
    if (!id) throw new BadRequestException('User ID not found in token');
    return id;
  }

  // الطلبات الأحدث من since (ISO)، بترتيب الإنشاء، جاهزة كسطور للجدول
  @Get('orders')
  async orders(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @GetUser() user: any,
    @Query('since') since?: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    await this.storeService.verifyOwnership(storeId, this.getUserId(user));
    const sinceDate = since ? new Date(since) : undefined;
    if (sinceDate && Number.isNaN(sinceDate.getTime())) throw new BadRequestException('since must be an ISO date');
    return this.ordersService.getOrdersForSheet(storeId, sinceDate, limit);
  }

  @Patch('orders/:orderId/status')
  async setStatus(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: SheetStatusDto,
    @GetUser() user: any,
  ) {
    await this.storeService.verifyOwnership(storeId, this.getUserId(user));
    return this.ordersService.setStatusFromSheet(storeId, orderId, dto.status);
  }
}
