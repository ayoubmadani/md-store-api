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
} as const;

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
