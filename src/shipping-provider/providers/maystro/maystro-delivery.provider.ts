import {
  LabelResult,
  ProviderMetadata,
  ShippingProviderContract,
  ShippingRate,
} from '../../interfaces/shipping-provider.interface';
import {
  CredentialsException,
  HttpShippingException,
  NotImplementedException,
} from '../../exceptions/shipping-exception.filter';
import { Order } from '../../../order/entities/order.entity';

const BASE = 'https://backend.maystro-delivery.com/api/';

export class MaystroDeliveryProvider implements ShippingProviderContract {
  private readonly token: string;

  private readonly validationRules: Record<string, string> = {
    wilaya: 'required|integer|min:1|max:58',
    commune: 'required|integer|min:1',
    destination_text: 'nullable|string|max:255',
    customer_phone: 'required|numeric|digits_between:9,10',
    customer_name: 'required|string|max:255',
    product_price: 'required|integer',
    delivery_type: 'required|integer|in:0,1',
    express: 'boolean',
    note_to_driver: 'nullable|string|max:255',
    products: 'required|array',
    source: 'required|equals:4',
    external_order_id: 'nullable|string|max:255',
  };

  constructor(credentials: Record<string, string>) {
    if (!credentials.token) {
      throw new CredentialsException(this.metadata().name, ['token']);
    }
    this.token = credentials.token;
  }

  metadata(): ProviderMetadata {
    return {
      name: 'MaystroDelivery',
      title: 'Maystro Delivery',
      logo: 'https://maystro-delivery.com/img/Maystro-blue-extonly.svg',
      description: 'Maystro Delivery — livraison rapide et sécurisée en Algérie',
      website: 'https://maystro-delivery.com/',
      api_docs: 'https://maystro.gitbook.io/maystro-delivery-documentation',
      support: 'https://maystro-delivery.com/ContactUS.html',
      tracking_url: 'https://maystro-delivery.com/trackingSD.html',
    };
  }

  private get authHeaders() {
    return { Authorization: `Token ${this.token}` };
  }

  async testCredentials(): Promise<boolean> {
    const res = await fetch(`${BASE}base/wilayas/?country=1`, { headers: this.authHeaders });
    if ([200, 201].includes(res.status)) return true;
    if (res.status === 401) return false;
    throw new HttpShippingException(`MaystroDelivery: unexpected status ${res.status}`);
  }

  async getRates(_fromWilayaId?: number, _toWilayaId?: number): Promise<ShippingRate[]> {
    throw new NotImplementedException('getRates');
  }

  getCreateOrderValidationRules(): Record<string, string> {
    return this.validationRules;
  }

  async createProduct(
    storeId: string,
    logisticalDescription: string,
    productId?: string,
  ): Promise<Record<string, unknown>> {
    const body: Record<string, string> = {
      store_id: storeId,
      logistical_description: logisticalDescription,
    };
    if (productId) body.product_id = productId;

    const res = await fetch(`${BASE}stores/product/`, {
      method: 'POST',
      headers: this.authHeaders,
      body: new URLSearchParams(body),
    });

    if (!res.ok) throw new HttpShippingException('MaystroDelivery: failed to create product');
    return res.json();
  }

  async createOrder(orderData: Record<string, unknown>): Promise<Record<string, unknown>> {
    const res = await fetch(`${BASE}stores/orders/`, {
      method: 'POST',
      headers: this.authHeaders,
      body: new URLSearchParams(orderData as Record<string, string>),
    });

    if (![200, 201].includes(res.status)) {
      throw new HttpShippingException(`MaystroDelivery: failed to create order (${res.status})`);
    }
    return res.json();
  }

  async createOrderFromOrder(order: Order): Promise<Record<string, unknown>> {
    // تحويل عناصر الطلب إلى الهيكل الذي تفهمه مايسترو
    const productsList = order.items?.map(item => ({
      description: item.product?.name || 'Produit',
      quantity: item.quantity
    })) || [{ description: 'Article', quantity: 1 }]; // قيمة احتياطية

    return this.createOrder({
      wilaya: String(order.customerWilayaId),
      commune: String(order.customerCommuneId),
      customer_name: order.customerName,
      customer_phone: order.customerPhone,
      destination_text: `${order.customerWilaya.ar_name} ${order.customerCommune.ar_name}`,
      product_price: String(Math.round(Number(order.totalPrice))),
      delivery_type: order.typeShip === 'home' ? '0' : '1',
      note_to_driver: '',
      products: JSON.stringify(productsList), // تمرير المصفوفة هنا
      source: '4',
      external_order_id: order.id,
    });
  }

  async getOrder(orderId: string): Promise<Record<string, unknown>> {
    const res = await fetch(`${BASE}stores/orders/${orderId}/`, { headers: this.authHeaders });
    if (![200, 201].includes(res.status)) {
      throw new HttpShippingException(`MaystroDelivery: order not found (${res.status})`);
    }
    return res.json();
  }

  async orderLabel(orderId: string): Promise<LabelResult> {
    const res = await fetch(`${BASE}delivery/starter/starter_bordureau/`, {
      method: 'POST',
      headers: this.authHeaders,
      body: new URLSearchParams({ all_created: 'true', orders_ids: orderId }),
    });

    if (![200, 201].includes(res.status)) {
      throw new HttpShippingException(`MaystroDelivery: failed to get label for ${orderId}`);
    }

    const buffer = await res.arrayBuffer();
    return { type: 'pdf', data: Buffer.from(buffer).toString('base64') };
  }
}