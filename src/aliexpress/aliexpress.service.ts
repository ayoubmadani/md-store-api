import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHmac, timingSafeEqual } from 'crypto';
import { AliexpressAccount } from './entities/aliexpress-account.entity';

const SYNC_URL = 'https://api-sg.aliexpress.com/sync';
const REST_URL = 'https://api-sg.aliexpress.com/rest';
const AUTHORIZE_URL = 'https://api-sg.aliexpress.com/oauth/authorize';
const STATE_TTL_MS = 15 * 60 * 1000;

export interface ImportedAttribute {
  name: string;
  type: 'color' | 'text';
  values: { value: string; image?: string }[];
}
export interface ImportedProduct {
  productId: string;
  name: string;
  desc: string;
  images: string[];
  price: number | null;
  originalPrice: number | null;
  currency: string;
  attributes: ImportedAttribute[];
}

@Injectable()
export class AliexpressService {
  private readonly logger = new Logger(AliexpressService.name);

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(AliexpressAccount) private readonly accounts: Repository<AliexpressAccount>,
  ) {}

  private get appKey() { return this.config.get<string>('ALIEXPRESS_APP_KEY'); }
  private get appSecret() { return this.config.get<string>('ALIEXPRESS_APP_SECRET'); }
  private get callbackUrl() { return this.config.get<string>('ALIEXPRESS_CALLBACK_URL'); }

  private ensureConfigured() {
    if (!this.appKey || !this.appSecret || !this.callbackUrl) {
      throw new ServiceUnavailableException('ربط AliExpress غير مُعدّ على الخادم (ALIEXPRESS_APP_KEY / ALIEXPRESS_APP_SECRET / ALIEXPRESS_CALLBACK_URL)');
    }
  }

  // توقيع AliExpress Open Platform: HMAC-SHA256 بالـ App Secret على
  // (مسار REST إن وُجد) + المفاتيح مرتبة أبجدياً ملصوقة بقيمها، بأحرف كبيرة
  private sign(params: Record<string, string>, apiPath?: string) {
    const base = (apiPath ?? '') + Object.keys(params).sort().map((k) => k + params[k]).join('');
    return createHmac('sha256', this.appSecret!).update(base, 'utf8').digest('hex').toUpperCase();
  }

  private async call(method: string, args: Record<string, string | number | undefined>, session?: string) {
    this.ensureConfigured();
    const isRest = method.startsWith('/');
    const params: Record<string, string> = {
      app_key: this.appKey!,
      sign_method: 'sha256',
      timestamp: String(Date.now()),
      ...(isRest ? {} : { method, format: 'json', v: '2.0' }),
      ...(session ? { session } : {}),
    };
    for (const [k, v] of Object.entries(args)) if (v !== undefined && v !== null && v !== '') params[k] = String(v);
    params.sign = this.sign(params, isRest ? method : undefined);

    const url = isRest ? `${REST_URL}${method}` : SYNC_URL;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: new URLSearchParams(params).toString(),
    });
    const data: any = await res.json().catch(() => null);
    if (!data) throw new ServiceUnavailableException('تعذر الاتصال بـ AliExpress');
    const err = data.error_response ?? (data.code && data.code !== '0' ? data : null);
    if (err) {
      this.logger.warn(`AliExpress ${method} error: ${JSON.stringify(err).slice(0, 500)}`);
      throw new BadRequestException(`AliExpress: ${err.msg || err.message || err.sub_msg || err.code}`);
    }
    return data;
  }

  // ── OAuth ──────────────────────────────────────────────────────────────
  private stateSig(payload: string) {
    return createHmac('sha256', this.config.get<string>('JWT_SECRET') || 'aliexpress').update(payload).digest('hex');
  }

  authorizeUrl(userId: string) {
    this.ensureConfigured();
    const payload = `${userId}.${Date.now()}`;
    const state = Buffer.from(`${payload}.${this.stateSig(payload)}`).toString('base64url');
    const q = new URLSearchParams({
      response_type: 'code',
      force_auth: 'true',
      redirect_uri: this.callbackUrl!,
      client_id: this.appKey!,
      state,
    });
    return `${AUTHORIZE_URL}?${q.toString()}`;
  }

  private userIdFromState(state: string): string {
    const [userId, ts, sig] = Buffer.from(state || '', 'base64url').toString().split('.');
    const expected = this.stateSig(`${userId}.${ts}`);
    const ok = !!sig && sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    if (!ok || Date.now() - Number(ts) > STATE_TTL_MS) throw new BadRequestException('رابط الربط غير صالح أو منتهي — أعد المحاولة');
    return userId;
  }

  async handleCallback(code: string, state: string) {
    const userId = this.userIdFromState(state);
    if (!code) throw new BadRequestException('لم تتم الموافقة على الربط');
    const t = await this.call('/auth/token/create', { code });
    await this.saveToken(userId, t);
    return userId;
  }

  private async saveToken(userId: string, t: any) {
    if (!t?.access_token) throw new BadRequestException('لم يُرجع AliExpress رمز الدخول');
    const toDate = (v: any) => (v ? new Date(Number(v)) : null);
    const existing = await this.accounts.findOne({ where: { userId } });
    await this.accounts.save({
      ...(existing ?? {}),
      userId,
      accessToken: t.access_token,
      refreshToken: t.refresh_token ?? existing?.refreshToken ?? null,
      expiresAt: toDate(t.expire_time) ?? (t.expires_in ? new Date(Date.now() + Number(t.expires_in) * 1000) : null),
      refreshExpiresAt: toDate(t.refresh_token_valid_time),
      account: t.account || t.user_nick || existing?.account || null,
    });
  }

  async status(userId: string) {
    const acc = await this.accounts.findOne({ where: { userId } });
    return {
      configured: !!(this.appKey && this.appSecret && this.callbackUrl),
      connected: !!acc,
      account: acc?.account ?? null,
      expiresAt: acc?.expiresAt ?? null,
    };
  }

  async disconnect(userId: string) {
    await this.accounts.delete({ userId });
    return { success: true };
  }

  private async sessionFor(userId: string) {
    const acc = await this.accounts.findOne({ where: { userId } });
    if (!acc) throw new NotFoundException('اربط حساب AliExpress أولاً');
    // تجديد الرمز قبل انتهائه بيوم
    if (acc.expiresAt && acc.expiresAt.getTime() - Date.now() < 24 * 3600 * 1000 && acc.refreshToken) {
      try {
        const t = await this.call('/auth/token/refresh', { refresh_token: acc.refreshToken });
        await this.saveToken(userId, t);
        return t.access_token as string;
      } catch (e) {
        this.logger.warn(`AliExpress token refresh failed for ${userId}`);
      }
    }
    return acc.accessToken;
  }

  // ── المنتجات ───────────────────────────────────────────────────────────
  static parseProductId(input: string): string {
    const s = (input || '').trim();
    const m = s.match(/\/item\/(\d{6,})/) || s.match(/[?&](?:productId|product_id|itemId)=(\d{6,})/) || s.match(/^(\d{6,})$/) || s.match(/(\d{10,})\.html/);
    if (!m) throw new BadRequestException('رابط منتج AliExpress غير صالح');
    return m[1];
  }

  async importProduct(userId: string, input: string, language = 'ar'): Promise<ImportedProduct> {
    const productId = AliexpressService.parseProductId(input);
    const session = await this.sessionFor(userId);
    const lang = ({ ar: 'AR', fr: 'FR', en: 'EN' } as Record<string, string>)[language] || 'EN';
    let data: any;
    try {
      data = await this.call('aliexpress.ds.product.get', { product_id: productId, ship_to_country: 'DZ', target_currency: 'USD', target_language: lang }, session);
    } catch {
      // بعض المنتجات لا تُشحن للجزائر — المعلومات نفسها لا تتغير، نعيد المحاولة بدولة أخرى
      data = await this.call('aliexpress.ds.product.get', { product_id: productId, ship_to_country: 'FR', target_currency: 'USD', target_language: lang }, session);
    }
    const r = data?.aliexpress_ds_product_get_response?.result;
    if (!r) throw new NotFoundException('لم يتم العثور على المنتج في AliExpress');
    return this.mapProduct(productId, r);
  }

  private mapProduct(productId: string, r: any): ImportedProduct {
    const base = r.ae_item_base_info_dto ?? {};
    const media = r.ae_multimedia_info_dto ?? {};
    const skus: any[] = r.ae_item_sku_info_dtos?.ae_item_sku_info_d_t_o ?? [];

    const images = String(media.image_urls || '').split(';').map((u) => u.trim()).filter(Boolean);

    const prices = skus.map((s) => Number(s.offer_sale_price ?? s.sku_price)).filter((n) => Number.isFinite(n) && n > 0);
    const origs = skus.map((s) => Number(s.sku_price)).filter((n) => Number.isFinite(n) && n > 0);

    // خصائص المنتج (لون/مقاس…) من خصائص الـ SKU — قيمة واحدة لكل اسم، مع صورة إن وُجدت
    const attrs = new Map<string, ImportedAttribute>();
    for (const sku of skus) {
      const props: any[] = sku.ae_sku_property_dtos?.ae_sku_property_d_t_o ?? [];
      for (const p of props) {
        const name = String(p.sku_property_name || '').trim();
        const value = String(p.property_value_definition_name || p.sku_property_value || '').trim();
        if (!name || !value || /ships from|shipping from|expédi|الشحن من/i.test(name)) continue;
        const attr = attrs.get(name) ?? { name, type: p.sku_image ? 'color' : 'text', values: [] };
        if (p.sku_image) attr.type = 'color';
        if (!attr.values.some((v) => v.value === value)) attr.values.push({ value, ...(p.sku_image ? { image: p.sku_image } : {}) });
        attrs.set(name, attr);
      }
    }

    return {
      productId,
      name: String(base.subject || '').trim(),
      desc: String(base.detail || base.mobile_detail || ''),
      images,
      price: prices.length ? Math.min(...prices) : null,
      originalPrice: origs.length ? Math.min(...origs) : null,
      currency: base.currency_code || 'USD',
      attributes: [...attrs.values()].filter((a) => a.values.length > 0),
    };
  }
}
