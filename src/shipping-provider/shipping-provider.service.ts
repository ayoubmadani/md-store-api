import { BadGatewayException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { StoreShippingSettings } from './entities/store-shipping-settings.entity';
import { createProvider, getAllProvidersMetadata } from './providers/provider.registry';
import { ShippingProviderContract } from './interfaces/shipping-provider.interface';
import { SetShippingProviderDto } from './dto/shipping.dto';
import { Order } from '../order/entities/order.entity';

@Injectable()
export class ShippingProviderService {
  constructor(
    @InjectRepository(StoreShippingSettings)
    private readonly settingsRepo: Repository<StoreShippingSettings>,

    @InjectRepository(Order) private readonly orderRepo: Repository<Order>
  ) {}

  // ─── Provider Registry ────────────────────────────────────────────────────

  getAllProviders() {
    return getAllProvidersMetadata();
  }

  // ─── Store Settings ───────────────────────────────────────────────────────

  async getStoreSettings(storeId: string): Promise<StoreShippingSettings | null> {
    return this.settingsRepo.findOne({ where: { storeId } });
  }

  async setStoreProvider(storeId: string, dto: SetShippingProviderDto): Promise<{ isVerified: boolean }> {
    const provider = createProvider(dto.providerName, dto.credentials);
    const isVerified = await provider.testCredentials();

    let settings = await this.settingsRepo.findOne({ where: { storeId } });
    if (!settings) settings = this.settingsRepo.create({ storeId });

    settings.providerName = dto.providerName;
    settings.setCredentials(dto.credentials);
    settings.isVerified = isVerified;

    await this.settingsRepo.save(settings);
    return { isVerified };
  }

  // ─── Provider Factory ─────────────────────────────────────────────────────

  private async getProviderForStore(storeId: string): Promise<ShippingProviderContract> {
    const settings = await this.getStoreSettings(storeId);

    if (!settings) {
      throw new NotFoundException(
        `No shipping provider configured for store ${storeId}. Please set one from the dashboard.`,
      );
    }

    return createProvider(settings.providerName, settings.getParsedCredentials());
  }

  // ─── Shipping Operations ──────────────────────────────────────────────────

  async testCredentials(storeId: string): Promise<boolean> {
    const provider = await this.getProviderForStore(storeId);
    return provider.testCredentials();
  }

  async getRates(storeId: string, fromWilayaId?: number, toWilayaId?: number) {
    const provider = await this.getProviderForStore(storeId);
    return provider.getRates(fromWilayaId, toWilayaId);
  }

  async getValidationRules(storeId: string) {
    const provider = await this.getProviderForStore(storeId);
    return provider.getCreateOrderValidationRules();
  }

  async createOrder(storeId: string, orderData: Record<string, unknown>) {
    const provider = await this.getProviderForStore(storeId);

    const order = await this.orderRepo.findOne({
      where: { id: orderData.id as string },
      relations: ['customerWilaya', 'customerCommune'],
    });

    if (!order) throw new BadGatewayException('Order not found');

    return provider.createOrderFromOrder(order);
  }

  async getOrder(storeId: string, trackingId: string) {
    const provider = await this.getProviderForStore(storeId);
    return provider.getOrder(trackingId);
  }

  async getOrderLabel(storeId: string, orderId: string) {
    const provider = await this.getProviderForStore(storeId);
    return provider.orderLabel(orderId);
  }

  async getProviderMetadata(storeId: string) {
    const settings = await this.getStoreSettings(storeId);
    if (!settings) return null;
    const provider = createProvider(settings.providerName, settings.getParsedCredentials());
    return provider.metadata();
  }
}