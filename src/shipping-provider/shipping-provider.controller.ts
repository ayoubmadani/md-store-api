import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SetShippingProviderDto, CreateShippingOrderDto } from './dto/shipping.dto';
import { ShippingProviderService } from './shipping-provider.service';
import { AuthGuard } from '../auth/guard/auth.guard';
import { GetUser } from '../user/decorator/get-user.decorator';
// قم بتفعيل الحراس (Guards) الخاصة بنظامك هنا
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('stores/:storeId/shipping')
@UseGuards(AuthGuard)
export class ShippingProviderController {
  constructor(private readonly shippingService: ShippingProviderService) {}

  // ─── مزودي الخدمة (العامة) ───
  @Get('providers')
  getAllProviders() {
    return this.shippingService.getAllProviders();
  }

  // ─── إدارة حسابات المستخدم ───

  @Get('accounts')
  getAccounts(@Param('storeId') storeId: string, @GetUser() user: any) {
    const userId = user.id || user.sub;
    return this.shippingService.getStoreAccounts(userId);
  }

  @Post('accounts')
  createAccount(
    @Param('storeId') storeId: string,
    @Body() dto: SetShippingProviderDto,
    @GetUser() user: any,
  ) {
    const userId = user.id || user.sub;
    return this.shippingService.createAccount(userId, dto);
  }

  @Patch('accounts/:accountId/default')
  setDefaultAccount(
    @Param('storeId') storeId: string,
    @Param('accountId') accountId: string,
    @GetUser() user: any,
  ) {
    const userId = user.id || user.sub;
    return this.shippingService.setDefaultAccount( userId, accountId);
  }

  @Delete('accounts/:accountId')
  deleteAccount(
    @Param('storeId') storeId: string,
    @Param('accountId') accountId: string,
    @GetUser() user: any,
  ) {
    const userId = user.id || user.sub;
    return this.shippingService.deleteAccount( userId, accountId);
  }

  // ─── عمليات الشحن ───

  @Get('test-credentials')
  testCredentials(@Param('storeId') storeId: string, @GetUser() user: any) {
    const userId = user.id || user.sub;
    return this.shippingService.testCredentials(storeId, userId);
  }

  @Get('rates')
  getRates(
    @Param('storeId') storeId: string,
    @GetUser() user: any,
    @Query('fromWilayaId') fromWilayaId?: string,
    @Query('toWilayaId') toWilayaId?: string,
  ) {
    const userId = user.id || user.sub;
    return this.shippingService.getRates(
      storeId,
      userId,
      fromWilayaId ? +fromWilayaId : undefined,
      toWilayaId ? +toWilayaId : undefined,
    );
  }

  @Get('validation-rules')
  getValidationRules(@Param('storeId') storeId: string, @GetUser() user: any) {
    const userId = user.id || user.sub;
    return this.shippingService.getValidationRules(storeId, userId);
  }

  @Post('orders')
  createOrder(
    @Param('storeId') storeId: string,
    @Body() dto: CreateShippingOrderDto,
    @GetUser() user: any,
  ) {
    const userId = user.id || user.sub;
    return this.shippingService.createOrder(storeId, userId, dto.orderData);
  }

  @Get('orders/:trackingId')
  getOrder(
    @Param('storeId') storeId: string,
    @Param('trackingId') trackingId: string,
    @GetUser() user: any,
  ) {
    const userId = user.id || user.sub;
    return this.shippingService.getOrder(storeId, userId, trackingId);
  }

  @Get('orders/:orderId/label')
  getLabel(
    @Param('storeId') storeId: string,
    @Param('orderId') orderId: string,
    @GetUser() user: any,
  ) {
    const userId = user.id || user.sub;
    return this.shippingService.getOrderLabel(storeId, userId, orderId);
  }
}