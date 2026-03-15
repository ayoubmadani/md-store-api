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

const PROCOLIS_BASE = 'https://procolis.com/api_v1';

export abstract class ProcolisProviderIntegration implements ShippingProviderContract {
  protected readonly token: string;
  protected readonly key: string;

  protected readonly validationRules: Record<string, string> = {
    Tracking: 'nullable|string',
    TypeLivraison: 'in:0,1',
    TypeColis: 'in:0,1',
    Confrimee: 'required|in:0,1',
    Client: 'required|string',
    MobileA: 'required|string',
    MobileB: 'nullable|string',
    Adresse: 'required|string',
    IDWilaya: 'required|numeric',
    Commune: 'required|string',
    Total: 'required|numeric',
    Note: 'nullable|string',
    TProduit: 'required|string',
    id_Externe: 'nullable|string',
    Source: 'nullable|string',
  };

  constructor(credentials: Record<string, string>) {
    if (!credentials.token || !credentials.key) {
      throw new CredentialsException(this.metadata().name, ['token', 'key']);
    }
    this.token = credentials.token;
    this.key = credentials.key;
  }

  abstract metadata(): ProviderMetadata;

  private get authHeaders() {
    return {
      token: this.token,
      key: this.key,
      'Content-Type': 'application/json',
    };
  }

  async testCredentials(): Promise<boolean> {
    const res = await fetch(`${PROCOLIS_BASE}/token`, { headers: this.authHeaders });
    if (!res.ok) return false;
    const json = await res.json();
    return json.Statut === 'Accès activé';
  }

  async getRates(fromWilayaId?: number, toWilayaId?: number): Promise<ShippingRate[]> {
    const res = await fetch(`${PROCOLIS_BASE}/tarification`, {
      method: 'POST',
      headers: this.authHeaders,
    });

    if (!res.ok) throw new HttpShippingException(`${this.metadata().name}: failed to get rates`);

    const result: ShippingRate[] = await res.json();

    if (toWilayaId) {
      const match = result.find((r) => r['IDWilaya'] == toWilayaId);
      return match ? [match] : [];
    }

    return result;
  }

  getCreateOrderValidationRules(): Record<string, string> {
    return this.validationRules;
  }

  async createOrder(orderData: Record<string, unknown>): Promise<Record<string, unknown>> {
    const res = await fetch(`${PROCOLIS_BASE}/add_colis`, {
      method: 'POST',
      headers: this.authHeaders,
      body: JSON.stringify({ Colis: [orderData] }),
    });

    const json = await res.json();
    const colis = json.Colis?.[0];
    const message = colis?.MessageRetour;

    if (message === 'Double Tracking') {
      throw new CreateOrderException('Duplicate Tracking ID');
    }
    if (message !== 'Good') {
      throw new CreateOrderException(message ?? `HTTP ${res.status}`);
    }

    return colis;
  }

  async getOrder(trackingId: string): Promise<Record<string, unknown>> {
    const res = await fetch(`${PROCOLIS_BASE}/lire`, {
      method: 'POST',
      headers: this.authHeaders,
      body: JSON.stringify({ Colis: [{ Tracking: trackingId }] }),
    });

    const text = await res.text();
    if (text === 'null') throw new TrackingIdNotFoundException(trackingId, this.metadata().name);

    const json = JSON.parse(text);
    return json.Colis[0];
  }

  async orderLabel(_orderId: string): Promise<LabelResult> {
    throw new FunctionNotSupportedException('orderLabel', this.metadata().name);
  }
}