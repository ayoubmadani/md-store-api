import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ImageService } from '../image/image.service';
import { StoreService } from '../store/store.service';
import { Product } from '../product/entities/product.entity';
import { ImageProduct } from '../image-product/entities/image-product.entity';

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 150_000;
const MAX_IMAGES = 4;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// توليد صور منتج بـ Higgsfield (طلب غير متزامن: إرسال ← متابعة الحالة ← النتيجة).
// النموذج قابل للتغيير من HIGGSFIELD_IMAGE_MODEL بدون تعديل الكود.
@Injectable()
export class HiggsfieldService {
  private readonly logger = new Logger(HiggsfieldService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly images: ImageService,
    private readonly stores: StoreService,
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(ImageProduct) private readonly productImages: Repository<ImageProduct>,
  ) {}

  // مفتاح واحد (لوحة open.higgsfield.ai) أو ID + Secret (الطريقة القديمة)
  private get auth() {
    const single = this.config.get<string>('HIGGSFIELD_API_KEY')?.trim();
    if (single) return `Key ${single}`;
    const id = this.config.get<string>('HIGGSFIELD_API_KEY_ID')?.trim();
    const secret = this.config.get<string>('HIGGSFIELD_API_KEY_SECRET')?.trim();
    if (id && !secret && id.includes(':')) return `Key ${id}`; // المفتاح الكامل id:secret في سطر ID
    if (!id || !secret) throw new ServiceUnavailableException('Higgsfield غير مُعدّ على الخادم (HIGGSFIELD_API_KEY)');
    return `Key ${id}:${secret}`;
  }
  private get baseUrl() {
    return (this.config.get<string>('HIGGSFIELD_BASE_URL') || 'https://api.higgsfield.ai').replace(/\/+$/, '');
  }
  private get model() {
    return (this.config.get<string>('HIGGSFIELD_IMAGE_MODEL') || 'higgsfield-ai/soul/standard').replace(/^\/+/, '');
  }

  private async hf(method: 'GET' | 'POST', url: string, body?: unknown) {
    const res = await fetch(url, {
      method,
      headers: { Authorization: this.auth, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
    const data: any = await res.json().catch(() => null);
    if (!res.ok) {
      this.logger.warn(`Higgsfield ${method} ${url} → ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
      throw new BadRequestException(`Higgsfield: ${data?.detail || data?.message || data?.error || res.status}`);
    }
    return data;
  }

  // صورة واحدة: إرسال الطلب ثم متابعة الحالة حتى الاكتمال
  private async generateOne(input: Record<string, unknown>): Promise<string> {
    const job = await this.hf('POST', `${this.baseUrl}/${this.model}`, input);
    const statusUrl: string = job?.status_url || (job?.request_id && `${this.baseUrl}/requests/${job.request_id}/status`);
    if (!statusUrl) throw new BadRequestException('Higgsfield: لم يُرجع رقم الطلب');

    const started = Date.now();
    while (Date.now() - started < POLL_TIMEOUT_MS) {
      const s = await this.hf('GET', statusUrl);
      const url = s?.images?.[0]?.url;
      if (s?.status === 'completed' && url) return url;
      if (['failed', 'nsfw', 'canceled'].includes(s?.status)) throw new BadRequestException(`Higgsfield: ${s.status}`);
      await sleep(POLL_INTERVAL_MS);
    }
    throw new BadRequestException('Higgsfield: انتهت مهلة التوليد — أعد المحاولة');
  }

  /**
   * يولّد صور منتج انطلاقاً من صورته الأصلية (إن وُجدت) ووصف المشهد، يحفظها في تخزين
   * المنصة (مكتبة صور التاجر)، ويضيفها اختيارياً إلى صور المنتج.
   */
  async generateProductImages(
    userId: string,
    storeId: string,
    productId: string,
    input: { prompt?: string; count?: number; aspectRatio?: string; addToProduct?: boolean },
  ) {
    await this.stores.verifyOwnership(storeId, userId);
    const product = await this.products.findOne({
      where: { id: productId, store: { id: storeId } } as any,
      relations: ['imagesProduct'],
    });
    if (!product) throw new BadRequestException('المنتج غير موجود');

    const reference = [...(product.imagesProduct ?? [])].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))[0]?.imageUrl;
    const prompt =
      input.prompt?.trim() ||
      `Professional e-commerce product photo of "${product.name}", clean studio lighting, soft shadow, ` +
        `high detail, commercial photography, keep the product exactly as in the reference image`;
    const count = Math.min(Math.max(Number(input.count) || 1, 1), MAX_IMAGES);

    const payload: Record<string, unknown> = {
      prompt,
      ...(reference ? { image_url: reference } : {}),
      ...(input.aspectRatio ? { aspect_ratio: input.aspectRatio } : {}),
    };

    const saved: string[] = [];
    const started = Date.now();
    for (let i = 0; i < count; i++) {
      // حد Vercel 300 ثانية للطلب: لا نبدأ صورة جديدة بعد ~3 دقائق، ونرجع ما جهز
      if (i > 0 && Date.now() - started > 180_000) break;
      const remote = await this.generateOne(payload);
      // نتائج Higgsfield تُحذف بعد ~7 أيام — نحفظ نسخة في تخزين المنصة
      const img = await this.images.importFromUrl(remote, userId, 'ai-products');
      saved.push(img.url);
    }

    if (input.addToProduct !== false && saved.length) {
      const last = Math.max(-1, ...(product.imagesProduct ?? []).map((i: any) => i.order ?? 0));
      await this.productImages.save(
        saved.map((imageUrl, i) => this.productImages.create({ imageUrl, order: last + 1 + i, product: { id: productId } as Product })),
      );
    }

    return {
      productId, model: this.model, usedReferenceImage: !!reference, images: saved,
      requested: count, addedToProduct: input.addToProduct !== false,
    };
  }
}
