import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { S3Service } from '../image/s3.service';
import { Wilaya } from '../shipping/entity/wilaya.entity';
import { Commune } from '../shipping/entity/commune.entity';

// بيانات خدمة المواقع (mdstore-locations) في R2:
//   locations/countries.json   ← قائمة الدول (العملة، مفتاح الهاتف، أسماء المستويات)
//   locations/<CC>.json        ← { country, regions: [{ id, code, name, ar_name, localities: [...] }] }
// الخدمة تقرأ من هنا، فإضافة دولة = كتابة هذه الملفات فقط (بلا نشر).

export type Locality = { id: number; name: string; ar_name: string; post_code?: string | null };
export type Region = { id: number; code?: string; name: string; ar_name: string; localities: Locality[] };
export type CountryMeta = {
  code: string; name: string; ar_name: string; fr_name?: string;
  currency: string; phone_prefix: string; phone_pattern?: string;
  levels: { region: Record<string, string>; locality: Record<string, string> };
  active: boolean;
};

const PREFIX = 'locations';
const DZ_META: CountryMeta = {
  code: 'DZ', name: 'Algeria', ar_name: 'الجزائر', fr_name: 'Algérie',
  currency: 'DZD', phone_prefix: '+213', phone_pattern: '^0[567]\\d{8}$',
  levels: { region: { ar: 'الولاية', fr: 'Wilaya', en: 'Province' }, locality: { ar: 'البلدية', fr: 'Commune', en: 'Municipality' } },
  active: true,
};

@Injectable()
export class LocationsAdminService {
  constructor(
    private readonly s3: S3Service,
    private readonly config: ConfigService,
    @InjectRepository(Wilaya) private readonly wilayas: Repository<Wilaya>,
    @InjectRepository(Commune) private readonly communes: Repository<Commune>,
  ) { }

  private async readJson<T>(file: string): Promise<T | null> {
    const base = (this.config.get<string>('AWS_PUBLIC_URL') || '').replace(/\/$/, '');
    if (!base) return null;
    const res = await fetch(`${base}/${PREFIX}/${file}?t=${Date.now()}`, { cache: 'no-store' });
    if (res.status === 404 || res.status === 403) return null;
    if (!res.ok) throw new BadRequestException(`تعذّر قراءة ${file} (${res.status})`);
    return (await res.json()) as T;
  }

  private writeJson(file: string, data: unknown) {
    return this.s3.uploadBuffer(Buffer.from(JSON.stringify(data)), `${PREFIX}/${file}`, 'application/json; charset=utf-8');
  }

  // قبل أول كتابة: الجزائر من جدولي wilayas/communes الحاليين (نفس الأرقام)
  private async dzFromDatabase(): Promise<Region[]> {
    const [ws, cs] = await Promise.all([
      this.wilayas.find({ where: { country: 'DZ' }, order: { id: 'ASC' } }),
      this.communes.find({ where: { country: 'DZ' }, order: { id: 'ASC' } }),
    ]);
    return ws.map((w) => ({
      id: w.id, code: `DZ-${String(w.id).padStart(2, '0')}`, name: w.name, ar_name: w.ar_name,
      localities: cs.filter((c) => c.wilayaId === w.id).map((c) => ({ id: c.id, name: c.name, ar_name: c.ar_name, post_code: c.post_code ?? null })),
    }));
  }

  async listCountries(): Promise<CountryMeta[]> {
    return (await this.readJson<CountryMeta[]>('countries.json')) ?? [DZ_META];
  }

  async getRegions(code: string): Promise<Region[]> {
    const cc = code.toUpperCase();
    const file = await this.readJson<{ regions: Region[] }>(`${cc}.json`);
    if (file) return file.regions;
    if (cc === 'DZ') return this.dzFromDatabase();
    throw new NotFoundException(`لا توجد بيانات للدولة ${cc}`);
  }

  // ملخّص للعرض: المناطق بدون قائمة البلديات
  async listRegions(code: string, regionId?: number) {
    const regions = await this.getRegions(code);
    if (regionId !== undefined) {
      const r = regions.find((x) => x.id === regionId);
      if (!r) throw new NotFoundException('المنطقة غير موجودة');
      return r;
    }
    return regions.map(({ localities, ...r }) => ({ ...r, localities_count: localities.length }));
  }

  async upsertCountry(meta: CountryMeta) {
    const countries = await this.listCountries();
    const i = countries.findIndex((c) => c.code === meta.code);
    if (i >= 0) countries[i] = { ...countries[i], ...meta };
    else countries.push(meta);
    await this.writeJson('countries.json', countries);
    return { country: meta.code, created: i < 0, countries: countries.map((c) => ({ code: c.code, active: c.active })) };
  }

  private validate(cc: string, regions: Region[]) {
    const errors: string[] = [];
    const rIds = new Set<number>(); const lIds = new Set<number>();
    for (const r of regions) {
      if (rIds.has(r.id)) errors.push(`منطقة مكررة ${r.id}`);
      rIds.add(r.id);
      if (!r.localities?.length) errors.push(`المنطقة ${r.id} بلا بلديات`);
      for (const l of r.localities || []) {
        if (lIds.has(l.id)) errors.push(`بلدية مكررة ${l.id}`);
        lIds.add(l.id);
      }
    }
    if (errors.length) throw new BadRequestException(errors.slice(0, 20).join(' · '));
    return regions.map((r) => ({ ...r, code: r.code || `${cc}-${String(r.id).padStart(2, '0')}` }));
  }

  // استبدال كل مناطق دولة (لإضافة دولة جديدة دفعة واحدة)
  async setRegions(code: string, regions: Region[]) {
    const cc = code.toUpperCase();
    const countries = await this.listCountries();
    if (!countries.some((c) => c.code === cc)) throw new BadRequestException(`أضف الدولة ${cc} أولاً (admin_upsert_country)`);
    const clean = this.validate(cc, regions);
    await this.writeJson(`${cc}.json`, { country: cc, regions: clean });
    await this.syncToPlatform(cc, clean);
    return this.summary(cc, clean);
  }

  // إضافة/استبدال منطقة واحدة مع بلدياتها
  async upsertRegion(code: string, region: Region) {
    const cc = code.toUpperCase();
    const regions = await this.getRegions(cc).catch(() => [] as Region[]);
    const i = regions.findIndex((r) => r.id === region.id);
    if (i >= 0) regions[i] = region; else regions.push(region);
    regions.sort((a, b) => a.id - b.id);
    const res = await this.setRegions(cc, regions);
    return { ...res, region: region.id, created: i < 0 };
  }

  // الطلبات وأسعار التوصيل مرتبطة بجدولي wilayas/communes (كل الدول بأرقام فريدة) — نضيف/نحدّث فقط (بلا حذف)
  private async syncToPlatform(cc: string, regions: Region[]) {
    const taken = await this.wilayas.createQueryBuilder('w').select(['w.id', 'w.country']).where('w.id IN (:...ids)', { ids: regions.map((r) => r.id) }).andWhere('w.country <> :cc', { cc }).getMany();
    if (taken.length) throw new BadRequestException(`أرقام مناطق مستعملة لدولة أخرى: ${taken.slice(0, 5).map((w) => `${w.id} (${w.country})`).join(', ')}`);
    await this.wilayas.upsert(regions.map((r) => ({ id: r.id, name: r.name, ar_name: r.ar_name, country: cc })), ['id']);
    const rows = regions.flatMap((r) => r.localities.map((l) => ({ id: l.id, name: l.name, ar_name: l.ar_name, post_code: l.post_code ?? undefined, wilayaId: r.id, country: cc })));
    for (let i = 0; i < rows.length; i += 500) await this.communes.upsert(rows.slice(i, i + 500), ['id']);
  }

  private summary(cc: string, regions: Region[]) {
    return { country: cc, regions: regions.length, localities: regions.reduce((n, r) => n + r.localities.length, 0) };
  }
}
