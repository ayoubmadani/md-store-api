import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import axios from 'axios';
import { BuilderPage } from './entities/builder-page.entity';
import { CreateBuilderPageDto } from './dto/create-builder-page.dto';
import { UpdateTreeDto } from './dto/update-tree.dto';
import { GenerateBuilderPageDto } from './dto/generate-builder-page.dto';
import { AnthropicService } from '../ai/anthropic.service';
import { GeminiService } from '../ai/gemini.service';
import { PollinationsImageService } from '../ai/pollinations-image.service';
import { BuilderBlock, sanitizeGeneratedBlocks } from '../ai/block-schema';
import { S3Service } from '../image/s3.service';
import { Product } from '../product/entities/product.entity';
import { StorePixel } from '../store/entities/store-pixel.entity';
import { Domain } from '../domain/entities/domain.entity';
import { Store } from '../store/entities/store.entity';
import { stripInactiveOptions } from '../product/product.service';

@Injectable()
export class BuilderPagesService {
  constructor(
    @InjectRepository(BuilderPage)
    private readonly builderPageRepo: Repository<BuilderPage>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(StorePixel)
    private readonly pixelRepo: Repository<StorePixel>,
    @InjectRepository(Domain)
    private readonly domainRepo: Repository<Domain>,
    @InjectRepository(Store)
    private readonly storeRepo: Repository<Store>,
    private readonly anthropicService: AnthropicService,
    private readonly geminiService: GeminiService,
    private readonly pollinationsImageService: PollinationsImageService,
    private readonly s3Service: S3Service,
  ) {}

  // Every guarded route below funnels through here (directly or via findOne)
  // to confirm the authenticated user actually owns the store a page belongs
  // to — a valid JWT alone used to be enough to read/edit/publish/delete any
  // store's page by guessing/copying its id. Same "not found" wording as
  // StoreService's own ownership checks, so a probing request can't tell an
  // owned-by-someone-else page apart from one that doesn't exist at all.
  private async assertOwnsStore(storeId: string, userId: string): Promise<void> {
    const store = await this.storeRepo.findOne({ where: { id: storeId, user: { id: userId } } });
    if (!store) throw new NotFoundException('الصفحة غير موجودة');
  }

  // حد الخطة لصفحات الهبوط (plan_features.landingPageNumber) — الصفحات المفعّلة للتاجر في كل متاجره
  // يُفحص عند الإنشاء والنسخ والتفعيل؛ التعطيل مسموح دائماً
  private async assertLandingPageLimit(userId: string) {
    const [plan] = await this.builderPageRepo.manager.query(
      `SELECT f."landingPageNumber" AS "limit"
         FROM subscriptions s
         JOIN plans p ON p.id = s."planId"
         JOIN plan_features f ON f.id = p."featuresId"
        WHERE s."userId"::text = $1 AND s.status = 'active' AND s."endDate" > now()
        ORDER BY s."startDate" DESC
        LIMIT 1`,
      [userId],
    ).catch(() => []);
    const limit = plan ? Number(plan.limit) || 0 : 0;
    const [{ count }] = await this.builderPageRepo.manager.query(
      `SELECT count(*)::int AS count FROM builder_pages WHERE "isActive" = true AND "storeId" IN (SELECT id::text FROM stores WHERE "userId"::text = $1)`,
      [userId],
    );
    const used = Number(count) || 0;
    if (used >= limit) {
      throw new BadRequestException(
        limit ? `وصلت إلى حد خطتك: ${limit} صفحات هبوط — رقِّ خطتك لإنشاء المزيد` : 'صفحات الهبوط غير متاحة في خطتك — رقِّ خطتك',
      );
    }
  }

  async create(dto: CreateBuilderPageDto, userId: string) {
    await this.assertOwnsStore(dto.storeId, userId);
    await this.assertLandingPageLimit(userId);

    if (dto.domain) {
      const existing = await this.builderPageRepo.findOne({ where: { domain: dto.domain } });
      if (existing) throw new ConflictException('هذا الرابط مستخدم بالفعل، جرّب اسمًا آخر للصفحة');
    }

    const page = this.builderPageRepo.create({
      name: dto.name,
      storeId: dto.storeId,
      productId: dto.productId || undefined,
      domain: dto.domain || undefined,
      platform: dto.platform || undefined,
      tree: [],
    });
    return this.builderPageRepo.save(page);
  }

  // Attaches showsCount/ordersCount as computed row-level counts (not raw
  // shows/orders arrays) — mirrors LandingPageService.getByStoreId exactly,
  // so the dashboard list can compute the same Views/Orders/CR% stats for
  // both features with identical logic.
  async getByStoreId(storeId: string, userId: string) {
    await this.assertOwnsStore(storeId, userId);
    return this.builderPageRepo
      .createQueryBuilder('bp')
      .loadRelationCountAndMap('bp.showsCount', 'bp.shows')
      .loadRelationCountAndMap('bp.ordersCount', 'bp.orders')
      .where('bp.storeId = :storeId', { storeId })
      .orderBy('bp.updatedAt', 'DESC')
      .getMany();
  }

  async toggleStatus(id: string, userId: string) {
    const page = await this.findOne(id, userId);
    if (!page.isActive) await this.assertLandingPageLimit(userId);
    page.isActive = !page.isActive;
    await this.builderPageRepo.save(page);
    return { isActive: page.isActive };
  }

  async updatePlatform(id: string, platform: string, userId: string) {
    const page = await this.findOne(id, userId);
    page.platform = platform;
    return this.builderPageRepo.save(page);
  }

  // ربط الصفحة بمنتج (أو فكّه بـ null) بعد إنشائها — لصفحة أُنشئت بلا منتج أو حُذف منتجها.
  // المتجر يقرأ productId الحالي من قاعدة البيانات، فلا حاجة لإعادة النشر.
  async updateProduct(id: string, productId: string | null, userId: string) {
    const page = await this.findOne(id, userId);
    if ((productId ?? null) === (page.productId ?? null)) return { id: page.id, productId: page.productId ?? null };

    // صفحة في اختبار A/B قيد التشغيل: كل صفحاته تبيع نفس المنتج، فلا يُغيَّر منتج إحداها وسط الاختبار
    const [running] = await this.builderPageRepo.query(
      `SELECT name FROM split_tests
       WHERE "isActive" AND "winnerPageId" IS NULL AND variants @> $1::jsonb LIMIT 1`,
      [JSON.stringify([{ builderPageId: page.id }])],
    );
    if (running) {
      throw new BadRequestException(`هذه الصفحة في اختبار A/B قيد التشغيل («${running.name}»)؛ أوقف الاختبار أو احذفه قبل تغيير منتجها`);
    }
    if (productId) {
      // findOne يستبعد المنتجات المحذوفة (soft delete)
      const product = await this.productRepo.findOne({ where: { id: productId, store: { id: page.storeId } }, select: ['id', 'name'] });
      if (!product) throw new NotFoundException('المنتج غير موجود في هذا المتجر');
    }
    page.productId = productId as any;
    await this.builderPageRepo.save(page);
    return { id: page.id, productId: page.productId ?? null };
  }

  async duplicate(id: string, userId: string) {
    const page = await this.findOne(id, userId);
    await this.assertLandingPageLimit(userId);
    const randomNumber = Math.floor(Math.random() * 1000) + 1;
    const copy = this.builderPageRepo.create({
      name: `${page.name} (نسخة)`,
      storeId: page.storeId,
      productId: page.productId,
      // domain is unique — a straight copy would collide with the original.
      domain: page.domain ? `${page.domain}-${randomNumber}` : undefined,
      platform: page.platform,
      tree: page.tree,
      settings: page.settings,
    });
    return this.builderPageRepo.save(copy);
  }

  // Feeds the productForm block: it needs the product's own info plus its
  // store's userId (for the public shipping-rates lookup) and subdomain
  // (for the order's `domain` field) — the same two values the real
  // storefront's ProductForm receives via `product.store.userId`/`.subdomain`.
  // attributes/variantDetails/offers are returned verbatim (same relations
  // ProductService.findOneByDomain loads) so the block's variant/offer
  // picker can reuse the exact matching logic the real storefront uses.
  async getProductInfo(productId: string) {
    const product = await this.productRepo.findOne({
      where: { id: productId },
      relations: ['store', 'store.user', 'attributes', 'attributes.variants', 'variantDetails', 'offers', 'imagesProduct'],
      order: { attributes: { id: 'ASC' }, imagesProduct: { order: 'ASC' } },
    });
    if (!product) throw new NotFoundException('المنتج غير موجود');
    stripInactiveOptions(product);
    return {
      id: product.id,
      name: product.name,
      price: product.price,
      productImage: product.imagesProduct?.[0]?.imageUrl,
      images: product.imagesProduct?.map((img) => img.imageUrl).filter(Boolean) ?? [],
      storeId: product.store?.id,
      userId: product.store?.user?.id,
      domain: product.store?.subdomain,
      attributes: product.attributes,
      variantDetails: product.variantDetails,
      offers: product.offers,
      isDigital: product.isDigital,
      supportQty: product.store?.supportQty,
    };
  }

  async findOne(id: string, userId: string) {
    const page = await this.builderPageRepo.findOne({ where: { id } });
    if (!page) throw new NotFoundException('الصفحة غير موجودة');
    await this.assertOwnsStore(page.storeId, userId);
    return page;
  }

  // Public lookup for the storefront — resolves a page's own domain (e.g.
  // "store.mdstore.top/lp/slug") the same way LandingPageService.getByDomain
  // does for the older module, which store/src/app/[domain]/lp/[lpdomain]
  // now tries first before falling back to that older lookup. Only
  // `publishedUrl` matters here — the storefront fetches that R2 JSON
  // snapshot directly rather than the DB's live (possibly newer, unpublished)
  // tree/settings, keeping the same draft/publish separation the editor has.
  // Fetches the published JSON from R2 server-side and returns it inline —
  // the storefront used to fetch `publishedUrl` itself from the browser,
  // which the R2 bucket's missing CORS headers silently blocked (a same-
  // origin failure that looked like a 404 further down the fallback chain).
  // A server-to-server fetch has no CORS restriction, so this sidesteps the
  // problem entirely instead of needing bucket-level CORS configuration.
  async findByDomain(domain: string) {
    const page = await this.builderPageRepo.findOne({ where: { domain } });
    if (!page || !page.publishedUrl) throw new NotFoundException('الصفحة غير موجودة');
    return this.buildPublicPayload(page);
  }

  // Public lookup by id — used when a page is reached via a dedicated
  // domain (domains.scope = 'landing_page'): the storefront only knows the
  // page's id from that Domain row, not this page's own `domain` column
  // (which may be unset, or a completely different "/lp/slug" value).
  async findPublicById(id: string) {
    const page = await this.builderPageRepo.findOne({ where: { id } });
    if (!page || !page.publishedUrl) throw new NotFoundException('الصفحة غير موجودة');
    return this.buildPublicPayload(page);
  }

  private async buildPublicPayload(page: BuilderPage) {
    const { data } = await axios.get(page.publishedUrl);

    // Pixels are looked up live rather than baked into the R2 snapshot, so
    // toggling/adding a pixel takes effect immediately without a republish.
    const pixels = await this.pixelRepo.find({
      where: [
        { storeId: page.storeId, scope: 'store', isActive: true },
        { storeId: page.storeId, scope: 'landing_page', builderPageId: page.id, isActive: true },
      ],
    });

    // المنتج الحالي من قاعدة البيانات (قد يكون تغيّر بعد آخر نشر)
    return { ...data, productId: page.productId ?? null, pixels };
  }

  // Silently drops any entry that isn't a real block object (e.g. a stray
  // empty array) instead of persisting it — a stale/buggy frontend session
  // can otherwise keep re-saving corrupted data over a manual DB fix on
  // every autosave, since the client has no way to know its own in-memory
  // state is broken. This is the server-side backstop for that.
  async updateTree(id: string, dto: UpdateTreeDto, userId: string) {
    const page = await this.findOne(id, userId);
    page.tree = Array.isArray(dto.tree)
      ? dto.tree.filter((block) => block && typeof block === 'object' && typeof (block as { type?: unknown }).type === 'string')
      : [];
    if (dto.settings !== undefined) page.settings = dto.settings;
    return this.builderPageRepo.save(page);
  }

  async remove(id: string, userId: string) {
    const page = await this.findOne(id, userId);
    // دومين مخصص لهذه الصفحة (scope: landing_page) لا معنى له بدونها —
    // ON DELETE SET NULL على builderPageId فقط يفرغ العمود، ويترك الصف
    // عالقاً بـ scope='landing_page' بدون صفحة، فنحذفه صراحةً هنا بدلاً
    // من ذلك.
    await this.domainRepo.delete({ builderPageId: id });
    await this.builderPageRepo.remove(page);
    return { success: true };
  }

  // Publishes the page's current tree as a static R2 asset at a stable,
  // per-page key ({id}.json) — republishing overwrites the same file rather
  // than accumulating new ones. Plain JSON, not a CommonJS module — unlike
  // the store's theme bundles (see ThemeRunner.tsx), a builder-page isn't
  // tied to a theme at all, so the storefront just fetches and JSON.parse()s
  // this directly; no eval/sandboxing needed.
  async publish(id: string, userId: string) {
    const page = await this.findOne(id, userId);

    if (!Array.isArray(page.tree) || page.tree.length === 0) {
      throw new BadRequestException('لا يمكن نشر صفحة فارغة');
    }
    const hasInvalidBlock = page.tree.some((block) => !block || typeof block !== 'object' || !block.type);
    if (hasInvalidBlock) {
      throw new BadRequestException('الصفحة تحتوي على عنصر غير صالح، يرجى حذفه قبل النشر');
    }

    // The productForm block has no product picker of its own anymore — it
    // always uses the page's own product, resolved here the same way
    // Canvas.jsx resolves it live in the editor (falling back to a legacy
    // block-level productId for pages built before this field existed), so
    // the published artifact is self-contained and correct on its own.
    const tree = page.tree.map((block) =>
      block.type === 'productForm'
        ? { ...block, props: { ...block.props, productId: page.productId || block.props?.productId } }
        : block,
    );
    const payload = { id: page.id, name: page.name, storeId: page.storeId, productId: page.productId, settings: page.settings, tree };
    const fileContent = JSON.stringify(payload, null, 2);
    const key = `builder-pages/${page.storeId}/${page.id}.json`;
    const { url } = await this.s3Service.uploadBuffer(Buffer.from(fileContent, 'utf-8'), key, 'application/json');

    page.publishedUrl = url;
    await this.builderPageRepo.save(page);
    return { publishedUrl: page.publishedUrl };
  }

  async generate(id: string, dto: GenerateBuilderPageDto, userId: string) {
    const page = await this.findOne(id, userId);
    const description = await this.resolveDescription(dto);
    let blocks = sanitizeGeneratedBlocks(await this.anthropicService.generatePageTree(description, dto.language));
    const { blocks: withPhotos, imageFailed } = await this.injectGeneratedPhotos(blocks, description, page.storeId);
    blocks = withPhotos;
    page.tree = blocks.map((block) => ({ id: randomUUID(), type: block.type, props: block.props }));
    const saved = await this.builderPageRepo.save(page);
    return { ...saved, imageFailed };
  }

  // Free-tier trial generation (Gemini) — not tied to a persisted page, used
  // by the editor's demo mode so anyone can try real AI output at no cost.
  async generateTrial(dto: GenerateBuilderPageDto) {
    const description = await this.resolveDescription(dto);
    let blocks = sanitizeGeneratedBlocks(await this.geminiService.generatePageTree(description, dto.language));
    const { blocks: withPhotos, imageFailed } = await this.injectGeneratedPhotos(blocks, description, 'trial');
    blocks = withPhotos;
    return { tree: blocks.map((block) => ({ id: randomUUID(), type: block.type, props: block.props })), imageFailed };
  }

  // AI as content assistant, not designer: the text model writes the order
  // form's copy and colors, but never invents an image URL. This fills the
  // page's image block's src/alt with a real, text-free hero photo (see
  // ReplicateImageService) uploaded to R2.
  private async injectGeneratedPhotos(
    blocks: BuilderBlock[],
    productDescription: string,
    keyPrefix: string,
  ): Promise<{ blocks: BuilderBlock[]; imageFailed: boolean }> {
    const imageIndexes = blocks
      .map((block, index) => (block.type === 'image' ? index : -1))
      .filter((index) => index !== -1);

    if (imageIndexes.length === 0) return { blocks, imageFailed: false };

    // Image generation is a separate third-party call (pollinations.ai, a
    // free keyless image API — deliberately not the paid, credit-metered
    // Replicate/flux-schnell path) from the text/color generation above
    // (Claude/Gemini) — if it fails (rate limit, a transient outage), the
    // page still gets the order form's already-generated copy and colors
    // rather than losing that work too. The image block just keeps no src,
    // which the editor already renders as its normal upload placeholder.
    // `imageFailed` lets the caller tell the merchant explicitly instead of
    // silently handing back a page that's quietly missing its hero photo.
    let photos: Buffer[];
    try {
      const variations = imageIndexes.map(() => 'professional landing page hero shot');
      photos = await this.pollinationsImageService.generateProductPhotos(productDescription, variations);
    } catch {
      return { blocks, imageFailed: true };
    }

    const updated = [...blocks];
    for (let i = 0; i < imageIndexes.length; i++) {
      const blockIndex = imageIndexes[i];
      // pollinations.ai returns JPEG bytes (verified: Content-Type
      // image/jpeg), unlike the old Replicate/flux-schnell path which was
      // explicitly asked for webp output — the extension/content-type here
      // must match what's actually being uploaded.
      const key = `builder-pages/${keyPrefix}/${randomUUID()}.jpg`;
      const { url } = await this.s3Service.uploadBuffer(photos[i], key, 'image/jpeg');
      updated[blockIndex] = {
        ...updated[blockIndex],
        props: { ...updated[blockIndex].props, src: url, alt: 'صورة المنتج' },
      };
    }
    return { blocks: updated, imageFailed: false };
  }

  // Backs the image block's own per-block "generate with AI" control (see
  // PropsPanel.jsx's ImageField) — a merchant-written prompt, one image,
  // dropped straight into that block's src the same way a manual upload
  // would be. Independent of the whole-page generation flow above.
  async generateImageFromPrompt(prompt: string) {
    if (!prompt?.trim()) throw new BadRequestException('يجب إدخال وصف للصورة');
    const buffer = await this.pollinationsImageService.generateImage(prompt.trim());
    const key = `builder-pages/manual/${randomUUID()}.jpg`;
    const { url } = await this.s3Service.uploadBuffer(buffer, key, 'image/jpeg');
    return { url };
  }

  private async resolveDescription(dto: GenerateBuilderPageDto): Promise<string> {
    if (dto.productId) {
      const product = await this.productRepo.findOne({ where: { id: dto.productId } });
      if (!product) throw new NotFoundException('المنتج غير موجود');
      const parts = [`اسم المنتج: ${product.name}`, `السعر: ${product.price} دج`];
      if (product.desc) parts.push(`الوصف: ${product.desc}`);
      return parts.join('\n');
    }
    if (dto.description?.trim()) return dto.description.trim();
    throw new BadRequestException('يجب إدخال وصف المنتج أو اختيار منتج موجود');
  }
}
