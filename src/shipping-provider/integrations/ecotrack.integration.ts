import {
  LabelResult,
  ProviderMetadata,
  ShippingProviderContract,
  ShippingRate,
} from '../interfaces/shipping-provider.interface';
import {
  CreateOrderException,
  CredentialsException,
  FunctionNotSupportedException,
  HttpShippingException,
  TrackingIdNotFoundException,
} from '../exceptions/shipping-exception.filter';
import { Order } from '../../order/entities/order.entity';

export abstract class EcotrackProviderIntegration implements ShippingProviderContract {
  protected readonly token: string;

  protected readonly validationRules: Record<string, string> = {
    reference: 'nullable|string|max:255',
    nom_client: 'required|string|max:255',
    telephone: 'required|numeric|digits_between:9,10',
    telephone_2: 'nullable|numeric|digits_between:9,10',
    adresse: 'required|string|max:255',
    code_postal: 'nullable|numeric',
    commune: 'required|string|max:255',
    code_wilaya: 'required|numeric|min:1|max:58',
    montant: 'required|numeric',
    remarque: 'nullable|string|max:255',
    produit: 'nullable|string|max:255',
    stock: 'integer|in:0,1',
    quantite: 'required_if:stock,1|integer|min:1',
    produit_a_recupere: 'nullable|string|max:255',
    boutique: 'nullable|string|max:255',
    type: 'required|integer|in:1,2,3,4',
    stop_desk: 'nullable|in:0,1',
  };

  constructor(credentials: Record<string, string>) {
    if (!credentials.token) {
      throw new CredentialsException(this.metadata().name, ['token']);
    }
    this.token = credentials.token;
  }

  abstract metadata(): ProviderMetadata;
  abstract apiDomain(): string;

  private get authHeaders() {
    return {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };
  }

  async testCredentials(): Promise<boolean> {
    const res = await fetch(`${this.apiDomain()}api/v1/get/wilayas`, {
      headers: this.authHeaders,
    });
    if (res.status === 200) return true;
    if ([401, 403].includes(res.status)) return false;
    throw new HttpShippingException(
      `${this.metadata().name}: unexpected status ${res.status}`,
      res.status,
    );
  }

  async getRates(fromWilayaId?: number, toWilayaId?: number): Promise<ShippingRate[]> {
    const res = await fetch(`${this.apiDomain()}api/v1/get/fees`, {
      headers: this.authHeaders,
    });

    if (!res.ok) throw new HttpShippingException(`${this.metadata().name}: failed to get rates`);

    const result = await res.json();

    if (!result?.livraison) {
      throw new HttpShippingException(`${this.metadata().name}: unexpected response format`);
    }

    const rates: ShippingRate[] = result.livraison;

    if (toWilayaId) {
      const match = rates.find((r) => r.wilaya_id == toWilayaId);
      return match ? [match] : [];
    }

    return rates;
  }

  getCreateOrderValidationRules(): Record<string, string> {
    return this.validationRules;
  }

  async createOrder(orderData: Record<string, unknown>): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.apiDomain()}api/v1/create/order`, {
      method: 'POST',
      headers: this.authHeaders,
      body: JSON.stringify(orderData),
    });

    const json = await res.json();

    if (!res.ok || json.success === false) {
      throw new CreateOrderException(json.message ?? `HTTP ${res.status}`);
    }

    return json;
  }

  async createOrderFromOrder(order: Order): Promise<Record<string, unknown>> {
    const isStopdesk = order.typeShip !== 'home';

    // حساب إجمالي الكمية من العناصر
    const totalQuantity = order.items?.reduce((sum, item) => sum + item.quantity, 0) || 1;
    
    // جلب أسماء المنتجات (اختياري، لكنه أفضل من 'Article1')
    const productsNames = order.items?.map(item => item.product?.name).join(' + ') || 'Produit';

    return this.createOrder({
      reference: order.id,
      nom_client: order.customerName,
      telephone: order.customerPhone,
      adresse: `${order.customerWilaya.ar_name} ${order.customerCommune.ar_name}`,
      code_wilaya: order.customerWilayaId,
      commune: order.customerCommune.ar_name,
      montant: Number(order.totalPrice),
      type: isStopdesk ? 2 : 1,   // 1=domicile, 2=stopdesk
      stop_desk: isStopdesk ? '1' : '0',
      produit: productsNames.substring(0, 255), // لضمان عدم تجاوز الحد المسموح
      quantite: totalQuantity,
    });
  }

  async getOrder(_trackingId: string): Promise<Record<string, unknown>> {
    throw new FunctionNotSupportedException('getOrder', this.metadata().name);
  }

  async orderLabel(orderId: string): Promise<LabelResult> {
    const res = await fetch(
      `${this.apiDomain()}api/v1/get/order/label?tracking=${orderId}`,
      { headers: this.authHeaders },
    );

    if (res.status === 422) throw new TrackingIdNotFoundException(orderId, this.metadata().name);
    if (!res.ok)
      throw new HttpShippingException(
        `${this.metadata().name}: failed to get label for ${orderId}`,
      );

    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');

    return { type: 'pdf', data: base64 };
  }
}