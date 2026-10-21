import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlatformSetting } from './platform-setting.entity';

// كل إعداد معروف: قيمته الافتراضية وطريقة التحقق منها
const SETTINGS = {
  // رسوم المنصة على شركة التأكيد عن كل طلب تؤكده (د.ج)
  confirmationFee: {
    default: 12,
    parse: (v: unknown) => {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > 10000) throw new BadRequestException('confirmationFee: رقم بين 0 و 10000');
      return Math.round(n * 100) / 100;
    },
  },
  // ثيم خاص يصنعه Claude للتاجر (بمفتاح Anthropic الخاص بالمنصة)
  customThemeEnabled: {
    default: false,
    parse: (v: unknown) => v === true || v === 'true',
  },
  customThemePrice: {
    default: 5000,
    parse: (v: unknown) => num(v, 0, 1_000_000, 'customThemePrice'),
  },
  customThemeRevisions: {
    default: 3,
    parse: (v: unknown) => Math.round(num(v, 0, 50, 'customThemeRevisions')),
  },
  customThemeRevisionPrice: {
    default: 1000,
    parse: (v: unknown) => num(v, 0, 1_000_000, 'customThemeRevisionPrice'),
  },
  // مدة الانتظار قبل النشر التلقائي (يراجع فيها الأدمن)
  customThemeDelayHours: {
    default: 2,
    parse: (v: unknown) => num(v, 0, 168, 'customThemeDelayHours'),
  },
  // شحن المحفظة بـ USDT عبر Binance (إيداع ثم TxID)
  binanceEnabled: {
    default: false,
    parse: (v: unknown) => v === true || v === 'true',
  },
  // سعر 1 USDT بالدينار — يحدده الأدمن
  usdtRateDzd: {
    default: 250,
    parse: (v: unknown) => num(v, 1, 10_000, 'usdtRateDzd'),
  },
  binanceTrc20Address: {
    default: '',
    parse: (v: unknown) => address(v, /^T[1-9A-HJ-NP-Za-km-z]{33}$/, 'binanceTrc20Address: عنوان TRC20 يبدأ بـ T (34 حرفاً)'),
  },
  // Binance UID للإرسال عبر Binance Pay (أسهل للتاجر: فوري وبلا رسوم)
  binanceUid: {
    default: '',
    parse: (v: unknown) => address(v, /^\d{6,12}$/, 'binanceUid: أرقام فقط (6 إلى 12)'),
  },
  binanceBep20Address: {
    default: '',
    parse: (v: unknown) => address(v, /^0x[0-9a-fA-F]{40}$/, 'binanceBep20Address: عنوان BEP20 يبدأ بـ 0x (42 حرفاً)'),
  },
} as const;

function address(v: unknown, re: RegExp, message: string) {
  const s = String(v ?? '').trim();
  if (s && !re.test(s)) throw new BadRequestException(message);
  return s;
}

function num(v: unknown, min: number, max: number, key: string) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) throw new BadRequestException(`${key}: رقم بين ${min} و ${max}`);
  return Math.round(n * 100) / 100;
}

export type PlatformSettings = { [K in keyof typeof SETTINGS]: ReturnType<(typeof SETTINGS)[K]['parse']> };

const CACHE_MS = 60_000;

@Injectable()
export class PlatformSettingsService {
  private cache: { at: number; values: PlatformSettings } | null = null;

  constructor(@InjectRepository(PlatformSetting) private readonly repo: Repository<PlatformSetting>) {}

  async getAll(): Promise<PlatformSettings> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.values;
    const rows = await this.repo.find();
    const values = Object.fromEntries(
      Object.entries(SETTINGS).map(([key, def]) => {
        const row = rows.find((r) => r.key === key);
        return [key, row ? def.parse(row.value) : def.default];
      }),
    ) as PlatformSettings;
    this.cache = { at: Date.now(), values };
    return values;
  }

  async get<K extends keyof PlatformSettings>(key: K): Promise<PlatformSettings[K]> {
    return (await this.getAll())[key];
  }

  /** من لوحة الإدارة: يحفظ فقط المفاتيح المعروفة بعد التحقق منها */
  async update(input: Record<string, unknown>): Promise<PlatformSettings> {
    const entries = Object.entries(input ?? {}).filter(([key]) => key in SETTINGS);
    if (!entries.length) throw new BadRequestException('لا توجد إعدادات معروفة للحفظ');
    await this.repo.save(
      entries.map(([key, value]) => ({ key, value: SETTINGS[key as keyof typeof SETTINGS].parse(value) })),
    );
    this.cache = null;
    return this.getAll();
  }
}
