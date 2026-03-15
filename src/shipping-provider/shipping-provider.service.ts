import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { StoreShippingSettings } from './entities/store-shipping-settings.entity';
import { createProvider, getAllProvidersMetadata } from './providers/provider.registry';
import { ShippingProviderContract } from './interfaces/shipping-provider.interface';
import { SetShippingProviderDto } from './dto/shipping.dto';

@Injectable()
export class ShippingProviderService {
  constructor(
    @InjectRepository(StoreShippingSettings)
    private readonly settingsRepo: Repository<StoreShippingSettings>,
  ) {}

  // ─── Provider Registry ────────────────────────────────────────────────────

  /**
   * Returns metadata of all 26 available providers.
   * Used to populate the provider selector in the dashboard.
   */
  getAllProviders() {
    return getAllProvidersMetadata();
  }

  // ─── Store Settings ───────────────────────────────────────────────────────

  async getStoreSettings(storeId: string): Promise<StoreShippingSettings | null> {
    return this.settingsRepo.findOne({ where: { storeId } });
  }

  /**
   * Save or update the shipping provider & credentials for a store.
   * Verifies credentials before saving.
   */
  async setStoreProvider(storeId: string, dto: SetShippingProviderDto): Promise<{ isVerified: boolean }> {
    // Validate provider exists by attempting instantiation
    const provider = createProvider(dto.providerName, dto.credentials);

    // Test credentials
    const isVerified = await provider.testCredentials();

    // Upsert settings
    let settings = await this.settingsRepo.findOne({ where: { storeId } });

    if (!settings) {
      settings = this.settingsRepo.create({ storeId });
    }

    settings.providerName = dto.providerName;
    settings.setCredentials(dto.credentials);
    settings.isVerified = isVerified;

    await this.settingsRepo.save(settings);

    return { isVerified };
  }

  // ─── Provider Factory ─────────────────────────────────────────────────────

  /**
   * Loads the provider instance for a given store.
   * Throws if no provider is configured.
   */
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
    return provider.createOrder(orderData);
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