import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import { BuilderPagesService } from '../builder-pages.service';
import { Product } from '../../product/entities/product.entity';
import { AnthropicService } from '../../ai/anthropic.service';
import { S3Service } from '../../image/s3.service';
import { ImagePageQuotaService } from './image-page-quota.service';
import { GenerateImagePageDto } from '../dto/generate-image-page.dto';
import { ImagePageInput, buildImagePageSystemPrompt, buildImagePageUserMessage, pickVariation, validateImagePageHtml } from './image-page-prompt';

export const IMAGE_PAGE_SECRET = 'IMAGE_PAGE_SECRET';
const AUTO_STYLES = ['auto', 'تلقائي'];
const SECTION_TYPES: Record<string, string> = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' };
const MAX_SECTION_BYTES = 2 * 1024 * 1024;
// دالة Vercel تُقطع عند 300 ثانية: لا نعيد المحاولة إن أخذت الأولى أكثر من دقيقتين
const RETRY_BUDGET_MS = 120_000;

// «تلقائي» ← طابع من فئة المنتج
export function styleForCategory(category?: string | null): string {
  const c = (category || '').toLowerCase();
  if (/sport|رياض|fitness|gym/.test(c)) return 'رياضي';
  if (/kid|child|baby|enfant|bébé|أطفال|طفل|ألعاب|رضيع/.test(c)) return 'أطفال';
  if (/perfume|parfum|jewel|bijou|watch|montre|عطر|عطور|مجوهرات|ساعات|ذهب/.test(c)) return 'فاخر';
  if (/health|santé|medical|طبي|صحة|صيدل/.test(c)) return 'طبي';
  if (/tradition|تقليدي|قفطان|برنوس/.test(c)) return 'تقليدي';
  return 'عصري بسيط';
}

const stripHtml = (s?: string | null) => (s || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

@Injectable()
export class ImagePageService {
  constructor(
    private readonly pages: BuilderPagesService,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    private readonly anthropic: AnthropicService,
    private readonly s3: S3Service,
    private readonly quota: ImagePageQuotaService,
    @Inject(IMAGE_PAGE_SECRET) private readonly secret: string,
  ) { }

  usage(userId: string) {
    return this.quota.usage(userId);
  }

  async generate(pageId: string, dto: GenerateImagePageDto, userId: string) {
    const page = await this.pages.findOne(pageId, userId);
    const input = await this.buildInput(dto, page.storeId);
    const system = buildImagePageSystemPrompt(input.language);
    const user = buildImagePageUserMessage(input, pickVariation());

    const result = await this.quota.consume(userId, { storeId: page.storeId, builderPageId: page.id, language: input.language, style: input.style }, async () => {
      const startedAt = Date.now();
      let out = await this.anthropic.generateImagePage(system, user);
      let check = validateImagePageHtml(out.html, input.cutouts, input.details);
      if (!check.ok && Date.now() - startedAt > RETRY_BUDGET_MS) {
        throw new UnprocessableEntityException(`تعذّر تصميم صفحة صالحة، حاول مرة أخرى (${check.reason})`);
      }
      if (!check.ok) {
        // محاولة واحدة فقط مع سبب الرفض، ثم فشل لا يُحتسب
        out = await this.anthropic.generateImagePage(system, `${user}\n\n## المحاولة السابقة رُفضت\n${check.reason}\nأعد الصفحة كاملة مع تصحيح ذلك.`);
        check = validateImagePageHtml(out.html, input.cutouts, input.details);
        if (!check.ok) throw new UnprocessableEntityException(`تعذّر تصميم صفحة صالحة، حاول مرة أخرى (${check.reason})`);
      }
      return out;
    });

    const sections = (result.html.match(/<section\b[^>]*class\s*=\s*["'][^"']*\bs\b[^"']*["']/gi) || []).length;
    const formAfter = Math.min(Math.max(0, Math.trunc(Number(result.formAfter) || 0)), sections - 1);
    return { generationId: this.signGeneration(userId, page.id), html: result.html, form: result.form, formAfter };
  }

  // startIndex: الرفع على دفعات (حد جسم الطلب 4.5MB في Vercel) مع ترقيم متصل
  async uploadSections(pageId: string, generationId: string, files: Express.Multer.File[], userId: string, startIndex = 0) {
    const page = await this.pages.findOne(pageId, userId);
    const uuid = this.verifyGeneration(generationId, userId, page.id);
    const start = Math.max(0, Math.trunc(Number(startIndex) || 0));
    if (!files?.length || start + files.length > 6) throw new BadRequestException('من 1 إلى 6 صور');
    for (const f of files) {
      if (!SECTION_TYPES[f.mimetype]) throw new BadRequestException('الصيغ المقبولة: webp و jpeg و png');
      if (f.size > MAX_SECTION_BYTES) throw new BadRequestException('حجم الصورة أكبر من 2MB');
    }
    // لا تُحسب من totalImagesNumber: جزء من صفحة الصور نفسها
    const uploaded = await Promise.all(files.map((f, i) =>
      this.s3.uploadBuffer(f.buffer, `image-pages/${page.storeId}/${uuid}/${start + i + 1}.${SECTION_TYPES[f.mimetype]}`, f.mimetype)));
    return { urls: uploaded.map((u) => u.url) };
  }

  private async buildInput(dto: GenerateImagePageDto, storeId: string): Promise<ImagePageInput> {
    const base = { language: dto.language, palette: dto.palette, cutouts: dto.cutouts, details: dto.details ?? 0, shipsAllWilayas: false };
    if (dto.productId) {
      const product = await this.productRepo.findOne({ where: { id: dto.productId }, relations: ['store', 'category', 'attributes', 'attributes.variants'] });
      if (!product || product.store?.id !== storeId) throw new NotFoundException('المنتج غير موجود');
      const variants = (product.attributes || [])
        .filter((a) => a.variants?.length)
        .map((a) => `${a.name}: ${a.variants.map((v) => v.name || v.value).join('، ')}`)
        .join(' | ');
      const category = product.category?.name;
      return {
        ...base,
        productName: product.name,
        description: [stripHtml(product.desc), dto.description?.trim()].filter(Boolean).join('\n'),
        price: Number(product.price),
        oldPrice: product.priceOriginal ? Number(product.priceOriginal) : null,
        variants,
        category,
        style: this.resolveStyle(dto.style, category),
      };
    }
    const description = dto.description?.trim();
    if (!description) throw new BadRequestException('يجب إدخال وصف المنتج أو اختيار منتج موجود');
    return { ...base, productName: description.split('\n')[0].slice(0, 80), description, price: dto.price ?? 0, oldPrice: null, style: this.resolveStyle(dto.style) };
  }

  private resolveStyle(style?: string, category?: string) {
    return !style || AUTO_STYLES.includes(style) ? styleForCategory(category) : style;
  }

  // رمز موقّع بدل صف في قاعدة البيانات: رفع الأقسام يتحقق أن الإنشاء لنفس التاجر ونفس الصفحة
  private hmac(userId: string, pageId: string, uuid: string) {
    return createHmac('sha256', this.secret).update(`${userId}:${pageId}:${uuid}`).digest('base64url');
  }

  private signGeneration(userId: string, pageId: string) {
    const uuid = randomUUID();
    return `${uuid}.${this.hmac(userId, pageId, uuid)}`;
  }

  private verifyGeneration(token: string, userId: string, pageId: string): string {
    const [uuid, sig] = String(token || '').split('.');
    if (!uuid || !sig || !/^[0-9a-f-]{36}$/.test(uuid)) throw new ForbiddenException('رمز الإنشاء غير صالح');
    const expected = Buffer.from(this.hmac(userId, pageId, uuid));
    const given = Buffer.from(sig);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) throw new ForbiddenException('رمز الإنشاء غير صالح');
    return uuid;
  }
}
