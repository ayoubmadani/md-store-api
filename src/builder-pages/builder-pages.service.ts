import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
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

@Injectable()
export class BuilderPagesService {
  constructor(
    @InjectRepository(BuilderPage)
    private readonly builderPageRepo: Repository<BuilderPage>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly anthropicService: AnthropicService,
    private readonly geminiService: GeminiService,
    private readonly pollinationsImageService: PollinationsImageService,
    private readonly s3Service: S3Service,
  ) {}

  async create(dto: CreateBuilderPageDto) {
    if (dto.domain) {
      const existing = await this.builderPageRepo.findOne({ where: { domain: dto.domain } });
      if (existing) throw new ConflictException('هذا الرابط مستخدم بالفعل، جرّب اسمًا آخر للصفحة');
    }

    const page = this.builderPageRepo.create({
      name: dto.name,
      storeId: dto.storeId,
      productId: dto.productId || undefined,
      domain: dto.domain || undefined,
      tree: [],
    });
    return this.builderPageRepo.save(page);
  }

  async getByStoreId(storeId: string) {
    return this.builderPageRepo.find({
      where: { storeId },
      order: { updatedAt: 'DESC' },
    });
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
      relations: ['store', 'store.user', 'attributes', 'attributes.variants', 'variantDetails', 'offers'],
      order: { attributes: { id: 'ASC' } },
    });
    if (!product) throw new NotFoundException('المنتج غير موجود');
    return {
      id: product.id,
      name: product.name,
      price: product.price,
      productImage: product.productImage,
      storeId: product.store?.id,
      userId: product.store?.user?.id,
      domain: product.store?.subdomain,
      attributes: product.attributes,
      variantDetails: product.variantDetails,
      offers: product.offers,
    };
  }

  async findOne(id: string) {
    const page = await this.builderPageRepo.findOne({ where: { id } });
    if (!page) throw new NotFoundException('الصفحة غير موجودة');
    return page;
  }

  // Public lookup for the storefront — resolves a page's own domain (e.g.
  // "store.mdstore.top/lp/slug") the same way LandingPageService.getByDomain
  // does for the older module, which store/src/app/[domain]/lp/[lpdomain]
  // now tries first before falling back to that older lookup. Only
  // `publishedUrl` matters here — the storefront fetches that R2 JSON
  // snapshot directly rather than the DB's live (possibly newer, unpublished)
  // tree/settings, keeping the same draft/publish separation the editor has.
  async findByDomain(domain: string) {
    const page = await this.builderPageRepo.findOne({ where: { domain } });
    if (!page || !page.publishedUrl) throw new NotFoundException('الصفحة غير موجودة');
    return { id: page.id, name: page.name, storeId: page.storeId, publishedUrl: page.publishedUrl };
  }

  // Silently drops any entry that isn't a real block object (e.g. a stray
  // empty array) instead of persisting it — a stale/buggy frontend session
  // can otherwise keep re-saving corrupted data over a manual DB fix on
  // every autosave, since the client has no way to know its own in-memory
  // state is broken. This is the server-side backstop for that.
  async updateTree(id: string, dto: UpdateTreeDto) {
    const page = await this.findOne(id);
    page.tree = Array.isArray(dto.tree)
      ? dto.tree.filter((block) => block && typeof block === 'object' && typeof (block as { type?: unknown }).type === 'string')
      : [];
    if (dto.settings !== undefined) page.settings = dto.settings;
    return this.builderPageRepo.save(page);
  }

  async remove(id: string) {
    const page = await this.findOne(id);
    await this.builderPageRepo.remove(page);
    return { success: true };
  }

  // Publishes the page's current tree as a static R2 asset at a stable,
  // per-page key ({id}.json) — republishing overwrites the same file rather
  // than accumulating new ones. Plain JSON, not a CommonJS module — unlike
  // the store's theme bundles (see ThemeRunner.tsx), a builder-page isn't
  // tied to a theme at all, so the storefront just fetches and JSON.parse()s
  // this directly; no eval/sandboxing needed.
  async publish(id: string) {
    const page = await this.findOne(id);

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

  async generate(id: string, dto: GenerateBuilderPageDto) {
    const page = await this.findOne(id);
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
