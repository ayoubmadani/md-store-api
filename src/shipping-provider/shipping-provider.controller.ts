import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SetShippingProviderDto, CreateShippingOrderDto } from './dto/shipping.dto';
import { ShippingProviderService } from './shipping-provider.service';
// import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';      // adjust to your guard
// import { StoreOwnerGuard } from '../auth/guards/store-owner.guard'; // adjust to your guard

@Controller('stores/:storeId/shipping')
// @UseGuards(JwtAuthGuard, StoreOwnerGuard)
export class ShippingProviderController {
  constructor(private readonly shippingService: ShippingProviderService) {}

  // ─── Provider Catalog (Dashboard) ────────────────────────────────────────

  /**
   * GET /stores/:storeId/shipping/providers
   * Returns all 26 available providers for the dashboard selector.
   */
  @Get('providers')
  getAllProviders() {
    return this.shippingService.getAllProviders();
  }

  // ─── Store Settings ───────────────────────────────────────────────────────

  /**
   * GET /stores/:storeId/shipping/settings
   * Returns the currently configured provider and its verification status.
   */
  @Get('settings')
  async getSettings(@Param('storeId') storeId: string) {
    const settings = await this.shippingService.getStoreSettings(storeId);
    if (!settings) return { configured: false };

    const metadata = await this.shippingService.getProviderMetadata(storeId);
    return {
      configured: true,
      providerName: settings.providerName,
      isVerified: settings.isVerified,
      metadata,
    };
  }

  /**
   * POST /stores/:storeId/shipping/settings
   * Set or update the shipping provider. Verifies credentials automatically.
   */
  @Post('settings')
  setProvider(
    @Param('storeId') storeId: string,
    @Body() dto: SetShippingProviderDto,
  ) {
    return this.shippingService.setStoreProvider(storeId, dto);
  }

  /**
   * GET /stores/:storeId/shipping/test-credentials
   * Re-test the currently saved credentials.
   */
  @Get('test-credentials')
  testCredentials(@Param('storeId') storeId: string) {
    return this.shippingService.testCredentials(storeId);
  }

  // ─── Shipping Operations ──────────────────────────────────────────────────

  /**
   * GET /stores/:storeId/shipping/rates?fromWilayaId=16&toWilayaId=31
   */
  @Get('rates')
  getRates(
    @Param('storeId') storeId: string,
    @Query('fromWilayaId') fromWilayaId?: string,
    @Query('toWilayaId') toWilayaId?: string,
  ) {
    return this.shippingService.getRates(
      storeId,
      fromWilayaId ? +fromWilayaId : undefined,
      toWilayaId ? +toWilayaId : undefined,
    );
  }

  /**
   * GET /stores/:storeId/shipping/validation-rules
   * Returns the required fields for createOrder for the active provider.
   */
  @Get('validation-rules')
  getValidationRules(@Param('storeId') storeId: string) {
    return this.shippingService.getValidationRules(storeId);
  }

  /**
   * POST /stores/:storeId/shipping/orders
   */
  @Post('orders')
  createOrder(
    @Param('storeId') storeId: string,
    @Body() dto: CreateShippingOrderDto,
  ) {
    return this.shippingService.createOrder(storeId, dto.orderData);
  }

  /**
   * GET /stores/:storeId/shipping/orders/:trackingId
   */
  @Get('orders/:trackingId')
  getOrder(
    @Param('storeId') storeId: string,
    @Param('trackingId') trackingId: string,
  ) {
    return this.shippingService.getOrder(storeId, trackingId);
  }

  /**
   * GET /stores/:storeId/shipping/orders/:orderId/label
   */
  @Get('orders/:orderId/label')
  getLabel(
    @Param('storeId') storeId: string,
    @Param('orderId') orderId: string,
  ) {
    return this.shippingService.getOrderLabel(storeId, orderId);
  }
}