import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { Product } from './entities/product.entity';
import { Attribute } from './entities/attribute.entity';
import { Variant } from './entities/variant.entity';
import { VariantDetail } from './entities/variant-detail.entity';
import { Offer } from './entities/offer.entity';
import { ImageProduct } from '../image-product/entities/image-product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AttributeDto } from './dto/sub-dtos/attribute.dto';
import { StoreService } from '../store/store.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { OrderItem } from '../order/entities/order-item.entity';
import { StatusEnum } from '../order/entities/order.entity';
import { LandingPage } from '../landing-page/entities/landing-page.entity';
import { BuilderPage } from '../builder-pages/entities/builder-page.entity';
import { Show } from '../show/entity/show.entity';

export interface VariantAttributeEntry {
  attrId: string;
  attrName: string;
  displayMode: 'color' | 'image' | 'text';
  value: string;
}

function normaliseVDName(raw: unknown): VariantAttributeEntry[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as VariantAttributeEntry[];
  if (typeof raw === 'object') {
    return Object.entries(raw as Record<string, string>).map(([attrName, value]) => ({
      attrId: '',
      attrName,
      displayMode: (value.startsWith('#') ? 'color' : 'text') as 'color' | 'text',
      value,
    }));
  }
  return [];
}

// مفتاح ثابت لتركيبة المتغير (مستقل عن ترتيب الخصائص وعن attrId المؤقت)
// — يُستخدم لمطابقة المتغيرات المولّدة تلقائياً التي لا تحمل id من الواجهة.
const vdKey = (entries: VariantAttributeEntry[]): string =>
  entries
    .map((e) => `${e.attrName}=${e.value}`)
    .sort()
    .join('|');

/**
 * يحذف العروض والمتغيرات المعطّلة من منتج قبل إرساله للواجهة العامة،
 * وكذلك قيم الخصائص (مثل اللون الأحمر) التي لم يبقَ لها أي متغير مفعّل،
 * حتى لا يظهر للزائر خيار لا يمكن طلبه.
 */
export function stripInactiveOptions<
  T extends { offers?: Offer[]; variantDetails?: VariantDetail[]; attributes?: Attribute[] },
>(product: T): T {
  if (!product) return product;
  if (Array.isArray(product.offers)) product.offers = product.offers.filter((o) => o.isActive !== false);
  if (!Array.isArray(product.variantDetails)) return product;

  const allEntries = product.variantDetails.flatMap((v) => normaliseVDName(v.name));
  product.variantDetails = product.variantDetails.filter((v) => v.isActive !== false);
  const activeEntries = product.variantDetails.flatMap((v) => normaliseVDName(v.name));

  if (Array.isArray(product.attributes)) {
    for (const attr of product.attributes) {
      // خاصية لا تظهر في أي تركيبة (بيانات قديمة) تُترك كما هي
      if (!Array.isArray(attr.variants) || !allEntries.some((e) => e.attrName === attr.name)) continue;
      attr.variants = attr.variants.filter((val) =>
        activeEntries.some((e) => e.attrName === attr.name && e.value === val.value),
      );
    }
  }
  return product;
}

const isUuid = (val: unknown): val is string =>
  typeof val === 'string' &&
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(val);

function generateCombinationsFromDto(
  attributes: AttributeDto[],
  defaultPrice: number,
): Array<{ attributes: VariantAttributeEntry[]; price: number; stock: number; autoGenerate: boolean }> {
  if (!attributes?.length) return [];

  const combinations: VariantAttributeEntry[][] = [];

  const recurse = (current: VariantAttributeEntry[], attrIndex: number) => {
    if (attrIndex === attributes.length) { combinations.push([...current]); return; }
    const attr = attributes[attrIndex];
    const displayMode: VariantAttributeEntry['displayMode'] =
      attr.type === 'color' ? ((attr.displayMode ?? 'color') as 'color' | 'image') : 'text';
    for (const variant of attr.variants ?? []) {
      recurse([...current, { attrId: '', attrName: attr.name, displayMode, value: variant.value }], attrIndex + 1);
    }
  };

  recurse([], 0);
  return combinations.map((attrs) => ({ attributes: attrs, price: -1, stock: 0, autoGenerate: true }));
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product) private productRepository: Repository<Product>,
    @InjectRepository(Attribute) private attributeRepository: Repository<Attribute>,
    @InjectRepository(Variant) private variantRepository: Repository<Variant>,
    @InjectRepository(VariantDetail) private variantDetailRepository: Repository<VariantDetail>,
    @InjectRepository(Offer) private offerRepository: Repository<Offer>,
    @InjectRepository(ImageProduct) private imageProductRepository: Repository<ImageProduct>,
    private readonly storeService: StoreService,
    private readonly dataSource: DataSource,
    private readonly subscriptionService: SubscriptionService,
  ) { }

  // ─── helper: قراءة الحد من features.productNumber ──────────────────────────
  private async getProductLimit(userId: string): Promise<number> {
    const sub = await this.subscriptionService.findSub(userId);
    return sub?.plan?.features?.productNumber ?? 4;
  }

  private async assertProductLimitNotReached(userId: string): Promise<void> {
    const [limit, count] = await Promise.all([
      this.getProductLimit(userId),
      this.productRepository.count({
        where: { isActive: true, store: { user: { id: userId } } },
      }),
    ]);
    if (count >= limit) {
      throw new BadRequestException(
        `لقد وصلت إلى الحد الأقصى للمنتجات النشطة في خطتك (${limit} منتجات).`
      );
    }
  }

  // ─── helper: قراءة الحد من features.productImagesNumber ────────────────────
  private async getProductImagesLimit(userId: string): Promise<number> {
    const sub = await this.subscriptionService.findSub(userId);
    return sub?.plan?.features?.productImagesNumber ?? 1;
  }

  private async assertProductImagesLimitNotReached(userId: string, imageCount: number): Promise<void> {
    const limit = await this.getProductImagesLimit(userId);
    if (imageCount > limit) {
      throw new BadRequestException(
        `الحد الأقصى لصور المنتج في خطتك هو ${limit} صورة.`
      );
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // CREATE
  // ══════════════════════════════════════════════════════════════════════════

  async create(storeId: string, userId: string, dto: CreateProductDto): Promise<Product> {
    await this.storeService.verifyOwnership(storeId, userId);

    console.log(dto);
    

    // ← فحص الحد قبل فتح transaction
    await this.assertProductLimitNotReached(userId);
    if (dto.images?.length) await this.assertProductImagesLimitNotReached(userId, dto.images.length);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const product = this.productRepository.create({
        name: dto.name, desc: dto.desc, price: dto.price,
        priceOriginal: dto.priceOriginal,
        sku: dto.sku, slug: dto.slug, stock: dto.stock ?? 0,
        isActive: dto.isActive ?? true,
        shippingFree: dto.shippingFree ?? false,
        isDigital: dto.isDigital ?? false,
        store: { id: storeId },
        category: dto.categoryId ? { id: dto.categoryId } : undefined,
      });
      const savedProduct = await queryRunner.manager.save(product);

      if (dto.attributes?.length) {
        for (const attrDto of dto.attributes) {
          const attribute = this.attributeRepository.create({
            name: attrDto.name, type: attrDto.type, displayMode: attrDto.displayMode,
            product: savedProduct,
          });
          const savedAttribute = await queryRunner.manager.save(attribute);
          for (const varDto of attrDto.variants ?? []) {
            await queryRunner.manager.save(
              this.variantRepository.create({ name: varDto.name, value: varDto.value, attribute: savedAttribute }),
            );
          }
        }
      }

      let vdList: any[] = dto.variantDetails ?? [];
      if (vdList.length === 0 && dto.attributes?.length) {
        vdList = generateCombinationsFromDto(dto.attributes, dto.price);
      }

      for (const vdDto of vdList) {
        await queryRunner.manager.save(
          this.variantDetailRepository.create({
            name: normaliseVDName(vdDto.attributes ?? vdDto.name ?? null),
            price: Number(vdDto.price) || dto.price,
            stock: Number(vdDto.stock) || 0,
            autoGenerate: vdDto.autoGenerate ?? false,
            product: savedProduct,
          } as any),
        );
      }

      for (const offerDto of dto.offers ?? []) {
        await queryRunner.manager.save(
          this.offerRepository.create({
            name: offerDto.name, subTitle: offerDto.subTitle,
            quantity: Number(offerDto.quantity),
            price: Number(offerDto.price),
            shippingFree: offerDto.shippingFree ?? false,
            product: savedProduct,
          }),
        );
      }

      for (const [index, imageUrl] of (dto.images ?? []).entries()) {
        await queryRunner.manager.save(
          this.imageProductRepository.create({ imageUrl, order: index, product: savedProduct }),
        );
      }

      await queryRunner.commitTransaction();
      return this.findOne(savedProduct.id, storeId, userId);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async createMulti(storeId: string, userId: string, dtos: CreateProductDto[]): Promise<Product[]> {
  // 1. التحقق من ملكية المتجر وفحص الحد (مرة واحدة قبل البدء)
  await this.storeService.verifyOwnership(storeId, userId);

  // يفضل هنا فحص ما إذا كان عدد المنتجات الجديدة سيتجاوز الحد المسموح به
  // مثلاً: await this.assertProductLimitNotReached(userId, dtos.length);

  const maxImages = await this.getProductImagesLimit(userId);
  const tooManyImages = dtos.find(dto => (dto.images?.length ?? 0) > maxImages);
  if (tooManyImages) {
    throw new BadRequestException(`الحد الأقصى لصور المنتج في خطتك هو ${maxImages} صورة.`);
  }

  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  const createdProducts: Product[] = [];

  try {
    for (const dto of dtos) {
      // --- إنشاء المنتج الأساسي ---
      const product = this.productRepository.create({
        name: dto.name, desc: dto.desc, price: dto.price,
        priceOriginal: dto.priceOriginal,
        sku: dto.sku, slug: dto.slug, stock: dto.stock ?? 0,
        isActive: dto.isActive ?? true,
        shippingFree: dto.shippingFree ?? false,
        isDigital: dto.isDigital ?? false,
        store: { id: storeId },
        category: dto.categoryId ? { id: dto.categoryId } : undefined,
      });
      const savedProduct = await queryRunner.manager.save(product);

      // --- معالجة الخصائص (Attributes) ---
      if (dto.attributes?.length) {
        for (const attrDto of dto.attributes) {
          const attribute = this.attributeRepository.create({
            name: attrDto.name, type: attrDto.type, displayMode: attrDto.displayMode,
            product: savedProduct,
          });
          const savedAttribute = await queryRunner.manager.save(attribute);
          
          for (const varDto of attrDto.variants ?? []) {
            await queryRunner.manager.save(
              this.variantRepository.create({ name: varDto.name, value: varDto.value, attribute: savedAttribute }),
            );
          }
        }
      }

      // --- معالجة تفاصيل المتغيرات (Variant Details) ---
      let vdList: any[] = dto.variantDetails ?? [];
      if (vdList.length === 0 && dto.attributes?.length) {
        vdList = generateCombinationsFromDto(dto.attributes, dto.price);
      }

      for (const vdDto of vdList) {
        await queryRunner.manager.save(
          this.variantDetailRepository.create({
            name: normaliseVDName(vdDto.attributes ?? vdDto.name ?? null),
            price: Number(vdDto.price) || dto.price,
            stock: Number(vdDto.stock) || 0,
            autoGenerate: vdDto.autoGenerate ?? false,
            product: savedProduct,
          } as any),
        );
      }

      // --- معالجة العروض (Offers) ---
      for (const offerDto of dto.offers ?? []) {
        await queryRunner.manager.save(
          this.offerRepository.create({
            name: offerDto.name, subTitle: offerDto.subTitle,
            quantity: Number(offerDto.quantity),
            price: Number(offerDto.price),
            shippingFree: offerDto.shippingFree ?? false,
            product: savedProduct,
          }),
        );
      }

      // --- معالجة الصور الإضافية ---
      for (const [index, imageUrl] of (dto.images ?? []).entries()) {
        await queryRunner.manager.save(
          this.imageProductRepository.create({ imageUrl, order: index, product: savedProduct }),
        );
      }

      createdProducts.push(savedProduct);
    }

    await queryRunner.commitTransaction();
    
    // إعادة جلب المنتجات مع علاقاتها (اختياري، حسب حاجتك للـ response)
    return Promise.all(createdProducts.map(p => this.findOne(p.id, storeId, userId)));

  } catch (error) {
    await queryRunner.rollbackTransaction();
    throw error;
  } finally {
    await queryRunner.release();
  }
}

  // ══════════════════════════════════════════════════════════════════════════
  // FIND ALL
  // ══════════════════════════════════════════════════════════════════════════

  async findAll(
    storeId: string,
    userId: string,
    page = 1,
    limit = 20,
    categoryId?: string,
    search?: string,
    isActive?: boolean,
  ): Promise<{ products: Product[]; total: number; page: number; totalPages: number }> {
    // التأكد من ملكية المتجر
    await this.storeService.verifyOwnership(storeId, userId);

    const qb = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.imagesProduct', 'images')
      // حساب عدد المشاهدات ووضعه في حقل showsCount
      .loadRelationCountAndMap('product.showsCount', 'product.shows')
      .leftJoinAndSelect('product.attributes', 'attributes')
      .leftJoinAndSelect('attributes.variants', 'variants')
      .where('product.storeId = :storeId', { storeId });

    // الفلاتر
    if (categoryId) {
      qb.andWhere('product.categoryId = :categoryId', { categoryId });
    }

    if (search) {
      // استخدم ILIKE لـ PostgreSQL أو LIKE لـ MySQL
      qb.andWhere('(product.name ILIKE :search OR product.desc ILIKE :search)', {
        search: `%${search}%`
      });
    }

    if (isActive !== undefined) {
      qb.andWhere('product.isActive = :isActive', { isActive });
    }

    // الترتيب والترقيم الصفحي
    qb.orderBy('product.createdAt', 'DESC')
      .addOrderBy('images.order', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [products, total] = await qb.getManyAndCount();

    return {
      products,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FIND ONE
  // ══════════════════════════════════════════════════════════════════════════

  async findOne(id: string, storeId: string, userId?: string): Promise<Product> {
    if (userId) await this.storeService.verifyOwnership(storeId, userId);
    const product = await this.productRepository.findOne({
      where: { id, store: { id: storeId } },
      relations: ['category', 'imagesProduct', 'attributes', 'attributes.variants', 'variantDetails', 'offers'],
      order: { imagesProduct: { order: 'ASC' } },
    });
    if (!product) throw new NotFoundException(`المنتج #${id} غير موجود`);
    return product;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // UPDATE
  // ══════════════════════════════════════════════════════════════════════════

  async update(id: string, storeId: string, userId: string, dto: UpdateProductDto) {
    await this.storeService.verifyOwnership(storeId, userId);
    const product = await this.findOne(id, storeId, userId);

    // فحص الحد فقط عند تفعيل منتج كان معطلاً
    if (product.isActive === false && dto.isActive === true) {
      await this.assertProductLimitNotReached(userId);
    }
    if (dto.images?.length) await this.assertProductImagesLimitNotReached(userId, dto.images.length);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      Object.assign(product, {
        name: dto.name ?? product.name,
        desc: dto.desc ?? product.desc,
        price: dto.price !== undefined ? Number(dto.price) : product.price,
        priceOriginal: dto.priceOriginal !== undefined ? Number(dto.priceOriginal) : product.priceOriginal,
        sku: dto.sku ?? product.sku,
        slug: dto.slug ?? product.slug,
        stock: dto.stock !== undefined ? Number(dto.stock) : product.stock,
        isActive: dto.isActive ?? product.isActive,
        shippingFree: dto.shippingFree ?? product.shippingFree,
        isDigital: dto.isDigital ?? product.isDigital,
        category: dto.categoryId ? { id: dto.categoryId } : product.category,
      });
      await queryRunner.manager.save(product);

      if (dto.attributes) {
        await queryRunner.manager.delete(Attribute, { product: { id } });
        for (const attrDto of dto.attributes) {
          const attribute = this.attributeRepository.create({
            id: isUuid(attrDto.id) ? attrDto.id : undefined,
            name: attrDto.name, type: attrDto.type, displayMode: attrDto.displayMode, product,
          });
          const savedAttribute = await queryRunner.manager.save(attribute);
          for (const varDto of attrDto.variants ?? []) {
            await queryRunner.manager.save(
              this.variantRepository.create({
                id: isUuid(varDto.id) ? varDto.id : undefined,
                name: varDto.name, value: varDto.value, attribute: savedAttribute,
              }),
            );
          }
        }
      }

      if (dto.images) {
        await queryRunner.manager.delete(ImageProduct, { product: { id } });
        for (const [index, imgUrl] of dto.images.entries()) {
          await queryRunner.manager.save(this.imageProductRepository.create({ imageUrl: imgUrl, order: index, product }));
        }
      }

      // المتغيرات والعروض تُحدَّث في مكانها (upsert) بدل الحذف وإعادة الإنشاء،
      // حتى لا تفقد الطلبات القديمة ربطها بها (إحصائيات صفحة المنتج) ولا
      // تضيع حالة التفعيل/التعطيل عند كل تعديل للمنتج.
      if (dto.variantDetails !== undefined) {
        let vdList: any[] = dto.variantDetails;
        if (vdList.length === 0 && dto.attributes?.length) {
          vdList = generateCombinationsFromDto(dto.attributes, dto.price ?? product.price);
        }

        const existing = await queryRunner.manager.find(VariantDetail, { where: { product: { id } } });
        const byId = new Map(existing.map((v) => [v.id, v]));
        const byKey = new Map(existing.map((v) => [vdKey(normaliseVDName(v.name)), v]));
        const kept = new Set<string>();

        for (const vdDto of vdList) {
          const name = normaliseVDName(vdDto.attributes ?? vdDto.name ?? null);
          const match = (isUuid(vdDto.id) && byId.get(vdDto.id)) || byKey.get(vdKey(name));
          const row = match && !kept.has(match.id)
            ? match
            : queryRunner.manager.create(VariantDetail, { product } as any);
          Object.assign(row, {
            name,
            price: Number(vdDto.price) || product.price,
            stock: Number(vdDto.stock) || 0,
            autoGenerate: vdDto.autoGenerate ?? false,
            isActive: vdDto.isActive ?? row.isActive ?? true,
          });
          const saved = await queryRunner.manager.save(row);
          kept.add(saved.id);
        }

        const removedIds = existing.filter((v) => !kept.has(v.id)).map((v) => v.id);
        if (removedIds.length) {
          await queryRunner.query(
            `UPDATE "order_items" SET "variantDetailId" = NULL WHERE "variantDetailId" = ANY($1)`,
            [removedIds],
          );
          await queryRunner.manager.delete(VariantDetail, removedIds);
        }
      }

      if (dto.offers) {
        const existing = await queryRunner.manager.find(Offer, { where: { product: { id } } });
        const byId = new Map(existing.map((o) => [o.id, o]));
        const kept = new Set<string>();

        for (const offerDto of dto.offers) {
          const match = isUuid(offerDto.id) ? byId.get(offerDto.id) : undefined;
          const row = match ?? this.offerRepository.create({ product });
          Object.assign(row, {
            name: offerDto.name, subTitle: offerDto.subTitle,
            quantity: Number(offerDto.quantity),
            price: Number(offerDto.price),
            shippingFree: offerDto.shippingFree ?? false,
            isActive: offerDto.isActive ?? row.isActive ?? true,
          });
          const saved = await queryRunner.manager.save(row);
          kept.add(saved.id);
        }

        const removedIds = existing.filter((o) => !kept.has(o.id)).map((o) => o.id);
        if (removedIds.length) {
          await queryRunner.query(
            `UPDATE "order_items" SET "offerId" = NULL WHERE "offerId" = ANY($1)`,
            [removedIds],
          );
          await queryRunner.manager.delete(Offer, removedIds);
        }
      }

      await queryRunner.commitTransaction();
      return this.findOne(id, storeId, userId);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async deactivateAllProducts(userId: string) {
    await this.productRepository.update(
      { store: { user: { id: userId } } },
      { isActive: false },
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DELETE / RESTORE / TOGGLE / STOCK
  // ══════════════════════════════════════════════════════════════════════════

  async remove(id: string, storeId: string, userId: string): Promise<{ message: string }> {
    await this.storeService.verifyOwnership(storeId, userId);
    await this.findOne(id, storeId, userId);
    try {
      await this.productRepository.softDelete(id);
      return { message: 'تم حذف المنتج بنجاح' };
    } catch {
      throw new InternalServerErrorException('فشل حذف المنتج من قاعدة البيانات');
    }
  }

  async forceRemove(id: string, storeId: string, userId: string): Promise<{ message: string }> {
    await this.storeService.verifyOwnership(storeId, userId);
    const product = await this.productRepository.findOne({
      where: { id, store: { id: storeId } }, withDeleted: true,
    });
    if (!product) throw new NotFoundException(`المنتج #${id} غير موجود`);
    try {
      await this.productRepository.remove(product);
      return { message: 'تم حذف المنتج نهائياً' };
    } catch {
      throw new InternalServerErrorException('فشل الحذف النهائي');
    }
  }

  async restore(id: string, storeId: string, userId: string): Promise<Product> {
    await this.storeService.verifyOwnership(storeId, userId);
    const product = await this.productRepository.findOne({
      where: { id, store: { id: storeId } }, withDeleted: true,
    });
    if (!product) throw new NotFoundException(`المنتج #${id} غير موجود`);
    if (!product.deletedAt) throw new BadRequestException('المنتج غير محذوف');
    try {
      await this.productRepository.recover(product);
      return this.findOne(id, storeId, userId);
    } catch {
      throw new InternalServerErrorException('فشل استعادة المنتج');
    }
  }

  async toggleActive(id: string, storeId: string, userId: string): Promise<Product> {
    await this.storeService.verifyOwnership(storeId, userId);
    const product = await this.findOne(id, storeId, userId);
    const newStatus = !product.isActive;

    // فحص الحد فقط عند التفعيل
    if (newStatus === true) {
      await this.assertProductLimitNotReached(userId);
    }

    product.isActive = newStatus;
    return this.productRepository.save(product);
  }

  async updateStock(id: string, storeId: string, userId: string, quantity: number): Promise<Product> {
    await this.storeService.verifyOwnership(storeId, userId);
    const product = await this.findOne(id, storeId, userId);
    if (quantity < 0) throw new BadRequestException('الكمية يجب أن تكون موجبة');
    product.stock = quantity;
    return this.productRepository.save(product);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STATS
  // ══════════════════════════════════════════════════════════════════════════

  async getStoreStats(storeId: string, userId: string) {
    await this.storeService.verifyOwnership(storeId, userId);
    const [totalProducts, activeProducts, outOfStock, totalValue] = await Promise.all([
      this.productRepository.count({ where: { store: { id: storeId } } }),
      this.productRepository.count({ where: { store: { id: storeId }, isActive: true } }),
      this.productRepository.count({ where: { store: { id: storeId }, stock: 0 } }),
      this.productRepository
        .createQueryBuilder('product')
        .select('SUM(product.price * product.stock)', 'total')
        .where('product.storeId = :storeId', { storeId })
        .getRawOne(),
    ]);
    return {
      totalProducts, activeProducts,
      inactiveProducts: totalProducts - activeProducts,
      outOfStock, totalValue: totalValue?.total || 0,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PRODUCT ANALYTICS (صفحة عرض المنتج)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * إحصائيات منتج واحد: ملخص المبيعات، أكثر العروض والمتغيرات مبيعاً،
   * وصفحات الهبوط الأكثر جلباً للطلبات، مع منحنى يومي.
   * الإيراد والوحدات تستثني الطلبات الملغاة والمرتجعة.
   * @param days نافذة زمنية بالأيام (بدونها = كل الفترة)
   */
  async getProductAnalytics(id: string, storeId: string, userId: string, days?: number) {
    const product = await this.findOne(id, storeId, userId);
    const since = days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : null;

    const params = {
      id, storeId, since,
      confirmed: [StatusEnum.CONFIRMED, StatusEnum.SHIPPING, StatusEnum.DELIVERED],
      lost: [StatusEnum.CANCELLED, StatusEnum.RETURNED],
    };

    // عناصر الطلبات الخاصة بهذا المنتج + أعمدة المبيعات المشتركة
    const itemsQuery = () => {
      const qb = this.dataSource
        .createQueryBuilder(OrderItem, 'item')
        .innerJoin('item.order', 'o')
        .select('COUNT(DISTINCT "o"."id")', 'orders')
        .addSelect('COUNT(DISTINCT "o"."id") FILTER (WHERE "o"."status" IN (:...confirmed))', 'confirmed')
        .addSelect('COALESCE(SUM("item"."quantity") FILTER (WHERE "o"."status" NOT IN (:...lost)), 0)', 'units')
        .addSelect('COALESCE(SUM("item"."totalPrice") FILTER (WHERE "o"."status" NOT IN (:...lost)), 0)', 'revenue')
        .where('"item"."productId" = :id')
        .andWhere('"o"."storeId" = :storeId');
      if (since) qb.andWhere('"o"."createdAt" >= :since');
      return qb.setParameters(params);
    };

    const showsQuery = (where: string, whereParams: Record<string, any>) => {
      const qb = this.dataSource
        .createQueryBuilder(Show, 's')
        .select('COUNT(*)', 'views')
        .where(where, whereParams);
      if (since) qb.andWhere('"s"."createdAt" >= :since', { since });
      return qb;
    };

    const [summaryRow, statusRows, offerRows, variantRows, pageRows, dailyRows, productViews, landingPages, builderPages] =
      await Promise.all([
        itemsQuery()
          .addSelect('COUNT(DISTINCT "o"."id") FILTER (WHERE "o"."status" = :delivered)', 'delivered')
          .setParameter('delivered', StatusEnum.DELIVERED)
          .getRawOne(),
        itemsQuery().addSelect('"o"."status"', 'status').groupBy('"o"."status"').getRawMany(),
        itemsQuery().addSelect('"item"."offerId"', 'offerId').groupBy('"item"."offerId"').getRawMany(),
        itemsQuery().addSelect('"item"."variantDetailId"', 'variantDetailId').groupBy('"item"."variantDetailId"').getRawMany(),
        itemsQuery()
          .addSelect('"o"."lpId"', 'lpId')
          .addSelect('"o"."builderPageId"', 'builderPageId')
          .groupBy('"o"."lpId"')
          .addGroupBy('"o"."builderPageId"')
          .getRawMany(),
        itemsQuery()
          .addSelect(`to_char(date_trunc('day', "o"."createdAt"), 'YYYY-MM-DD')`, 'day')
          .groupBy('day')
          .orderBy('day', 'ASC')
          .getRawMany(),
        showsQuery('"s"."productId" = :id', { id }).getRawOne(),
        this.dataSource.getRepository(LandingPage).find({ where: { productId: id } }),
        this.dataSource.getRepository(BuilderPage).find({ where: { productId: id, storeId } }),
      ]);

    const toStats = (row?: any) => ({
      orders: Number(row?.orders ?? 0),
      confirmed: Number(row?.confirmed ?? 0),
      units: Number(row?.units ?? 0),
      revenue: Number(row?.revenue ?? 0),
    });
    const bySales = (a: { units: number; orders: number }, b: { units: number; orders: number }) =>
      b.units - a.units || b.orders - a.orders;

    // ── العروض والمتغيرات (تشمل التي لم تُبع بعد) ─────────────────────────
    const offerStats = new Map(offerRows.map((r) => [r.offerId, r]));
    const offers = product.offers
      .map((o) => ({
        id: o.id, name: o.name, subTitle: o.subTitle, quantity: o.quantity, price: o.price,
        shippingFree: o.shippingFree, isActive: o.isActive,
        ...toStats(offerStats.get(o.id)),
      }))
      .sort(bySales);

    const variantStats = new Map(variantRows.map((r) => [r.variantDetailId, r]));
    const variants = product.variantDetails
      .map((v) => ({
        id: v.id,
        name: normaliseVDName(v.name),
        label: normaliseVDName(v.name).map((e) => e.value).join(' / '),
        price: v.price, stock: v.stock, isActive: v.isActive,
        ...toStats(variantStats.get(v.id)),
      }))
      .sort(bySales);

    // ── صفحات الهبوط (القديمة + المبنية بالمحرر + الطلبات من المتجر مباشرة) ─
    const lpIds = new Set([...landingPages.map((lp) => lp.id), ...pageRows.map((r) => r.lpId).filter(Boolean)]);
    const bpIds = new Set([...builderPages.map((bp) => bp.id), ...pageRows.map((r) => r.builderPageId).filter(Boolean)]);

    // صفحات وصلت منها طلبات لهذا المنتج لكنها غير مربوطة به مباشرة
    const missingLp = [...lpIds].filter((lid) => !landingPages.some((lp) => lp.id === lid));
    const missingBp = [...bpIds].filter((bid) => !builderPages.some((bp) => bp.id === bid));
    const [extraLp, extraBp, lpViews, bpViews] = await Promise.all([
      missingLp.length ? this.dataSource.getRepository(LandingPage).find({ where: { id: In(missingLp) } }) : [],
      missingBp.length ? this.dataSource.getRepository(BuilderPage).find({ where: { id: In(missingBp), storeId } }) : [],
      lpIds.size
        ? showsQuery('"s"."lpId" IN (:...ids)', { ids: [...lpIds] }).addSelect('"s"."lpId"', 'pageId').groupBy('"s"."lpId"').getRawMany()
        : [],
      bpIds.size
        ? showsQuery('"s"."builderPageId" IN (:...ids)', { ids: [...bpIds] }).addSelect('"s"."builderPageId"', 'pageId').groupBy('"s"."builderPageId"').getRawMany()
        : [],
    ]);

    const viewsOf = (rows: any[], pageId: string) => Number(rows.find((r) => r.pageId === pageId)?.views ?? 0);
    const withConversion = <T extends { orders: number; views: number }>(row: T) => ({
      ...row,
      conversionRate: row.views ? Number(((row.orders / row.views) * 100).toFixed(2)) : null,
    });

    type PageStats = ReturnType<typeof toStats> & {
      id: string | null; type: 'landing' | 'builder' | 'store'; name: string | null; domain: string | null;
      platform: string | null; isActive: boolean; views: number; conversionRate: number | null;
    };
    const pages: PageStats[] = [
      ...[...landingPages, ...extraLp].map((lp) => withConversion({
        id: lp.id, type: 'landing' as const, name: String(lp.domain), domain: String(lp.domain),
        platform: lp.platform, isActive: lp.isActive,
        views: viewsOf(lpViews, lp.id),
        ...toStats(pageRows.find((r) => r.lpId === lp.id)),
      })),
      ...[...builderPages, ...extraBp].map((bp) => withConversion({
        id: bp.id, type: 'builder' as const, name: bp.name, domain: bp.domain,
        platform: bp.platform, isActive: bp.isActive,
        views: viewsOf(bpViews, bp.id),
        ...toStats(pageRows.find((r) => r.builderPageId === bp.id)),
      })),
    ];
    const direct = pageRows.find((r) => !r.lpId && !r.builderPageId);
    if (direct) {
      pages.push(withConversion({
        id: null, type: 'store', name: null, domain: null, platform: null, isActive: true,
        views: 0, ...toStats(direct),
      }));
    }
    pages.sort((a, b) => b.orders - a.orders || b.revenue - a.revenue);

    const summary = toStats(summaryRow);
    const views = Number(productViews?.views ?? 0);

    return {
      product: {
        id: product.id, name: product.name, price: product.price, stock: product.stock,
        isActive: product.isActive, isDigital: product.isDigital,
        image: product.imagesProduct?.[0]?.imageUrl ?? null,
        category: product.category ? { id: product.category.id, name: product.category.name } : null,
      },
      range: { days: days ?? null, since },
      summary: {
        ...summary,
        delivered: Number(summaryRow?.delivered ?? 0),
        views,
        conversionRate: views ? Number(((summary.orders / views) * 100).toFixed(2)) : null,
        averageOrderValue: summary.orders ? Number((summary.revenue / summary.orders).toFixed(2)) : 0,
      },
      statuses: statusRows.map((r) => ({ status: r.status, orders: Number(r.orders) })),
      daily: dailyRows.map((r) => ({ day: r.day, ...toStats(r) })),
      offers,
      variants,
      pages,
    };
  }

  async toggleOfferActive(productId: string, offerId: string, storeId: string, userId: string): Promise<Offer> {
    await this.storeService.verifyOwnership(storeId, userId);
    const offer = await this.offerRepository.findOne({
      where: { id: offerId, product: { id: productId, store: { id: storeId } } },
    });
    if (!offer) throw new NotFoundException('العرض غير موجود');
    offer.isActive = !offer.isActive;
    return this.offerRepository.save(offer);
  }

  async toggleVariantActive(productId: string, variantId: string, storeId: string, userId: string): Promise<VariantDetail> {
    await this.storeService.verifyOwnership(storeId, userId);
    const variant = await this.variantDetailRepository.findOne({
      where: { id: variantId, product: { id: productId, store: { id: storeId } } },
    });
    if (!variant) throw new NotFoundException('المتغير غير موجود');
    variant.isActive = !variant.isActive;
    return this.variantDetailRepository.save(variant);
  }

  async updateOffer(
    productId: string, offerId: string, storeId: string, userId: string,
    dto: { price?: number; quantity?: number },
  ): Promise<Offer> {
    await this.storeService.verifyOwnership(storeId, userId);
    const offer = await this.offerRepository.findOne({
      where: { id: offerId, product: { id: productId, store: { id: storeId } } },
    });
    if (!offer) throw new NotFoundException('العرض غير موجود');
    if (dto.price !== undefined) offer.price = Number(dto.price);
    if (dto.quantity !== undefined) offer.quantity = Number(dto.quantity);
    return this.offerRepository.save(offer);
  }

  async updateVariant(
    productId: string, variantId: string, storeId: string, userId: string,
    dto: { price?: number; stock?: number },
  ): Promise<VariantDetail> {
    await this.storeService.verifyOwnership(storeId, userId);
    const variant = await this.variantDetailRepository.findOne({
      where: { id: variantId, product: { id: productId, store: { id: storeId } } },
    });
    if (!variant) throw new NotFoundException('المتغير غير موجود');
    if (dto.price !== undefined) variant.price = Number(dto.price);
    if (dto.stock !== undefined) variant.stock = Number(dto.stock);
    return this.variantDetailRepository.save(variant);
  }

  /**
   * تفعيل/تعطيل قيمة خاصية كاملة (مثلاً اللون الأحمر) = كل التركيبات التي تحتويها.
   */
  async setAttributeValueActive(
    productId: string, storeId: string, userId: string,
    attrName: string, value: string, isActive: boolean,
  ): Promise<{ attrName: string; value: string; isActive: boolean; variantIds: string[] }> {
    await this.storeService.verifyOwnership(storeId, userId);
    const variants = await this.variantDetailRepository.find({
      where: { product: { id: productId, store: { id: storeId } } },
    });
    const isTarget = (e: VariantAttributeEntry) => e.attrName === attrName && e.value === value;
    const targets = variants.filter((v) => normaliseVDName(v.name).some(isTarget));
    if (!targets.length) throw new NotFoundException('لا توجد تركيبات بهذه القيمة');

    // عند إعادة التفعيل: لا نفعّل تركيبة تحتوي قيمة أخرى معطّلة بالكامل
    // (مثلاً تفعيل الأحمر لا يعيد "أحمر / M" إذا كان المقاس M معطّلاً)
    const fullyDisabled = new Set<string>();
    if (isActive) {
      const states = new Map<string, boolean[]>();
      for (const v of variants) {
        for (const e of normaliseVDName(v.name)) {
          const k = `${e.attrName}=${e.value}`;
          states.set(k, [...(states.get(k) ?? []), v.isActive]);
        }
      }
      for (const [k, list] of states) if (list.every((a) => !a)) fullyDisabled.add(k);
    }
    const variantIds = targets
      .filter((v) => !isActive || !normaliseVDName(v.name).some(
        (e) => !isTarget(e) && fullyDisabled.has(`${e.attrName}=${e.value}`),
      ))
      .map((v) => v.id);
    if (!variantIds.length) return { attrName, value, isActive, variantIds };

    await this.variantDetailRepository.update({ id: In(variantIds) }, { isActive });
    return { attrName, value, isActive, variantIds };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PUBLIC (Domain-based)
  // ══════════════════════════════════════════════════════════════════════════

  async findAllByDomain(
    domainName: string, // غيرنا الاسم ليكون أوضح
    page = 1,
    limit = 20,
    categoryId?: string,
    search?: string,
  ) {
    // تنظيف الدومين من www. لضمان المطابقة
    const cleanDomain = domainName.replace(/^www\./, '');

    const qb = this.productRepository
      .createQueryBuilder('product')
      .innerJoin('product.store', 'store')
      // إضافة Join لجدول الدومينات لنتحقق من الدومين الخارجي أيضاً
      .leftJoin('store.domains', 'storeDomain')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.imagesProduct', 'images')
      .leftJoinAndSelect('product.attributes', 'attributes')
      .leftJoinAndSelect('attributes.variants', 'variants')
      // هنا التعديل الجوهري: ابحث في السبدومين "أو" في الدومين الخارجي
      .where('(store.subdomain = :identifier OR storeDomain.domain = :identifier)', { identifier: cleanDomain })
      .andWhere('product.isActive = :isActive', { isActive: true })
      .andWhere('product.deletedAt IS NULL');

    // ... بقية الكود (categoryId, search, pagination) كما هي

    if (categoryId) qb.andWhere('product.categoryId = :categoryId', { categoryId });
    if (search) qb.andWhere('(product.name ILIKE :search OR product.desc ILIKE :search)', { search: `%${search}%` });

    qb.orderBy('product.createdAt', 'DESC').addOrderBy('images.order', 'ASC').skip((page - 1) * limit).take(limit);
    const [products, total] = await qb.getManyAndCount();

    return { products, total, page, totalPages: Math.ceil(total / limit) };
  }


  async findOneByDomain(domainName: string, productId: string): Promise<any> {
    // 1. تنظيف الدومين من www.
    const cleanDomain = domainName.replace(/^www\./, '');

    const product = await this.productRepository.findOne({
      where: [
        // البحث بالـ ID والتحقق من السبدومين "أو" الدومين الخارجي
        { id: productId, isActive: true, store: { subdomain: cleanDomain } },
        { id: productId, isActive: true, store: { domains: { domain: cleanDomain } } },

        // البحث بالـ Slug والتحقق من السبدومين "أو" الدومين الخارجي
        { slug: productId, isActive: true, store: { subdomain: cleanDomain } },
        { slug: productId, isActive: true, store: { domains: { domain: cleanDomain } } },
      ],
      relations: [
        'store', 'store.themeUser', 'store.theme', 'store.user',
        'store.domains', // مهم جداً إضافة هذه العلاقة ليتمكن TypeORM من البحث فيها
        'category', 'imagesProduct', 'attributes', 'attributes.variants',
        'variantDetails', 'offers',
      ],
      order: { attributes: { id: 'ASC' }, imagesProduct: { order: 'ASC' } },
    });

    if (!product) throw new NotFoundException('المنتج غير موجود في هذا المتجر');
    stripInactiveOptions(product);

    console.log({
      ...product,
      store: product.store ? {
        id: product.store.id,
        name: product.store.name,
        cart: product.store.cart,
        subdomain: product.store.subdomain,
        userId: product.store.user.id,
        theme: product.store.theme ? {
          id: product.store.theme.id,
          slug: product.store.theme.slug,
          name: product.store.theme.name_en,
        } : null,
      } : null,
      category: product.category
        ? { id: product.category.id, name: product.category.name }
        : null,
    });
    

    return {
      ...product,
      store: product.store ? {
        id: product.store.id,
        name: product.store.name,
        cart: product.store.cart,
        subdomain: product.store.subdomain,
        userId: product.store.user.id,
        theme: product.store.theme ? {
          id: product.store.theme.id,
          slug: product.store.theme.slug,
          name: product.store.theme.name_en,
        } : null,
      } : null,
      category: product.category
        ? { id: product.category.id, name: product.category.name }
        : null,
    };
  }

  async getVariants(productId: string) {
    return this.variantDetailRepository.find({ where: { product: { id: productId }, isActive: true } });
  }

  async getOffers(productId: string) {
    return this.offerRepository.find({ where: { product: { id: productId }, isActive: true } });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // saas (Domain-based)
  // ══════════════════════════════════════════════════════════════════════════

  async findAllProduct(
    page = 1,
    limit = 20,
    categoryId?: string,
    search?: string,
  ) {
    // تنظيف الدومين من www. لضمان المطابقة

    const qb = this.productRepository
      .createQueryBuilder('product')
      .innerJoin('product.store', 'store')
      // إضافة Join لجدول الدومينات لنتحقق من الدومين الخارجي أيضاً
      .leftJoin('store.domains', 'storeDomain')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.imagesProduct', 'images')
      .leftJoinAndSelect('product.attributes', 'attributes')
      .leftJoinAndSelect('attributes.variants', 'variants')
      // هنا التعديل الجوهري: ابحث في السبدومين "أو" في الدومين الخارجي
      .andWhere('product.isActive = :isActive', { isActive: true })
      .andWhere('product.deletedAt IS NULL');

    // ... بقية الكود (categoryId, search, pagination) كما هي

    if (categoryId) qb.andWhere('product.categoryId = :categoryId', { categoryId });
    if (search) qb.andWhere('(product.name ILIKE :search OR product.desc ILIKE :search)', { search: `%${search}%` });

    qb.orderBy('product.createdAt', 'DESC').addOrderBy('images.order', 'ASC').skip((page - 1) * limit).take(limit);
    const [products, total] = await qb.getManyAndCount();

    return { products, total, page, totalPages: Math.ceil(total / limit) };
  }

  async findOneById(productId: string): Promise<any> {

    const product = await this.productRepository.findOne({
      where: [
        // البحث بالـ ID والتحقق من السبدومين "أو" الدومين الخارجي
        { id: productId },
        { id: productId },

        // البحث بالـ Slug والتحقق من السبدومين "أو" الدومين الخارجي
        { slug: productId },
        { slug: productId },
      ],
      relations: [
        'store', 'store.themeUser', 'store.themeUser.theme', 'store.user',
        'store.domains', // مهم جداً إضافة هذه العلاقة ليتمكن TypeORM من البحث فيها
        'category', 'imagesProduct', 'attributes', 'attributes.variants',
        'variantDetails', 'offers',
      ],
      order: { attributes: { id: 'ASC' }, imagesProduct: { order: 'ASC' } },
    });

    if (!product) throw new NotFoundException('المنتج غير موجود في هذا المتجر');
    stripInactiveOptions(product);

    const payload = {
      ...product,
      store: product.store ? {
        id: product.store.id,
        cart:product.store.cart,
        name: product.store.name,
        subdomain: product.store.subdomain,
        userId: product.store.user.id,
        theme: product.store.themeUser?.theme ? {
          id: product.store.themeUser.theme.id,
          slug: product.store.themeUser.theme.slug,
          name: product.store.themeUser.theme.name_en,
        } : null,
      } : null,
      category: product.category
        ? { id: product.category.id, name: product.category.name }
        : null,
    };

    console.log(payload);
    

    return payload
  }
}