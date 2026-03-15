export interface ProviderMetadata {
  name: string;
  title: string;
  logo: string | null;
  description: string;
  website: string;
  api_docs: string | null;
  support: string | null;
  tracking_url: string | null;
}

export interface LabelResult {
  type: 'pdf' | 'url';
  data: string;
}

export interface ShippingRate {
  wilaya_id?: number;
  [key: string]: unknown;
}

export interface ShippingProviderContract {
  testCredentials(): Promise<boolean>;
  getRates(fromWilayaId?: number, toWilayaId?: number): Promise<ShippingRate[]>;
  getCreateOrderValidationRules(): Record<string, string>;
  createOrder(orderData: Record<string, unknown>): Promise<Record<string, unknown>>;
  getOrder(trackingId: string): Promise<Record<string, unknown>>;
  orderLabel(orderId: string): Promise<LabelResult>;
  metadata(): ProviderMetadata;
}
