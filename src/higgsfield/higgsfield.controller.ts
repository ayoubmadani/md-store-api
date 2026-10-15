import { BadRequestException, Body, Controller, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/guard/auth.guard';
import { AllowApiKey } from '../auth/decorator/allow-api-key.decorator';
import { GetUser } from '../user/decorator/get-user.decorator';
import { HiggsfieldService } from './higgsfield.service';
import { RequirePermission } from '../team/guards/store-access.decorator';
import { StorePermission } from '../team/permissions';
import { LogActivity } from '../team/activity.interceptor';

// توليد صور منتج بالذكاء الاصطناعي (Higgsfield) — متاح بمفتاح API (Claude عبر MCP)
@Controller('stores/:storeId/products/:productId/ai-images')
@UseGuards(AuthGuard)
export class HiggsfieldController {
  constructor(private readonly higgsfield: HiggsfieldService) {}

  @Post()
  @AllowApiKey()
  // عضو الفريق بصلاحية المنتجات — يعمل باسم المالك (رصيد وخطة المالك)
  @RequirePermission(StorePermission.PRODUCT_CRUD)
  @LogActivity('product', 'update', { param: 'productId' })
  generate(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @GetUser() user: any,
    @Body() body: { prompt?: string; count?: number; aspectRatio?: string; addToProduct?: boolean },
  ) {
    const userId = user?.id || user?.sub;
    if (!userId) throw new BadRequestException('User ID not found in token');
    return this.higgsfield.generateProductImages(userId, storeId, productId, body ?? {});
  }
}
