import {
  LabelResult,
  ProviderMetadata,
  ShippingProviderContract,
  ShippingRate,
} from '../interfaces/shipping-provider.interface';
import {
  CreateOrderException,
  CredentialsException,
  HttpShippingException,
  TrackingIdNotFoundException,
} from '../exceptions/shipping-exception.filter';

export abstract class YalidineProviderIntegration implements ShippingProviderContract {
  protected readonly apiId: string;
  protected readonly apiToken: string;

  protected readonly validationRules: Record<string, string> = {
    order_id: 'required|string',
    from_wilaya_name: 'required|string',
    firstname: 'required|string',
    familyname: 'required|string',
    contact_phone: 'required|string',
    address: 'required|string',
    to_commune_name: 'required|string',
    to_wilaya_name: 'required|string',
    product_list: 'required|string',
    price: 'required|numeric|min:0|max:150000',
    do_insurance: 'required|boolean',
    declared_value: 'required|numeric|min:0|max:150000',
    length: 'required|numeric|min:0',
    width: 'required|numeric|min:0',
    height: 'required|numeric|min:0',
    weight: 'required|numeric|min:0',
    freeshipping: 'required|boolean',
    is_stopdesk: 'required|boolean',
    stopdesk_id: 'required_if:is_stopdesk,true|string',
    has_exchange: 'required|boolean',
    product_to_collect: 'sometimes|nullable',
  };

  constructor(credentials: Record<string, string>) {
    if (!credentials.id || !credentials.token) {
      throw new CredentialsException(this.metadata().name, ['id', 'token']);
    }
    this.apiId = credentials.id;
    this.apiToken = credentials.token;
  }

  abstract metadata(): ProviderMetadata;
  abstract apiDomain(): string;

  private get authHeaders() {
    return {
      'X-API-ID': this.apiId,
      'X-API-TOKEN': this.apiToken,
      'Content-Type': 'application/json',
    };
  }

  async testCredentials(): Promise<boolean> {
    const res = await fetch(`${this.apiDomain()}/v1/wilayas/`, {
      headers: this.authHeaders,
    });
    if (res.status === 200) return true;
    if ([401, 500].includes(res.status)) return false;
    throw new HttpShippingException(`${this.metadata().name}: unexpected status ${res.status}`);
  }

  async getRates(fromWilayaId?: number, toWilayaId?: number): Promise<ShippingRate[]> {
    const url = `${this.apiDomain()}/v1/fees/?from_wilaya_id=${fromWilayaId ?? ''}&to_wilaya_id=${toWilayaId ?? ''}`;
    const res = await fetch(url, { headers: this.authHeaders });

    if (!res.ok) throw new HttpShippingException(`${this.metadata().name}: failed to get rates`);

    return res.json();
  }

  getCreateOrderValidationRules(): Record<string, string> {
    return this.validationRules;
  }

  async createOrder(orderData: Record<string, unknown>): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.apiDomain()}/v1/parcels/`, {
      method: 'POST',
      headers: this.authHeaders,
      body: JSON.stringify([orderData]),
    });

    const json = await res.json();
    const orderId = orderData.order_id as string;
    const orderResult = json[orderId];

    if (orderResult?.success !== 'true') {
      throw new CreateOrderException(orderResult?.message ?? `HTTP ${res.status}`);
    }

    return orderResult;
  }

  async getOrder(trackingId: string): Promise<Record<string, unknown>> {
    const res = await fetch(`${this.apiDomain()}/v1/parcels/${trackingId}`, {
      headers: this.authHeaders,
    });

    const json = await res.json();

    if (json.total_data === 0) {
      throw new TrackingIdNotFoundException(trackingId, this.metadata().name);
    }

    return json.data[0];
  }

  async orderLabel(orderId: string): Promise<LabelResult> {
    const order = await this.getOrder(orderId);
    return { type: 'url', data: order.label as string };
  }
}