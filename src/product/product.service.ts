import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
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

// ─────────────────────────────────────────────────────────────────────────────
// Shape stored in VariantDetail.name (JSON column)
// e.g. [{ attrId, attrName, displayMode: 'color'|'image'|'text', value }]
// ─────────────────────────────────────────────────────────────────────────────
export interface VariantAttributeEntry {
  attrId: string;   // temp front-end id or '' – not a DB FK
  attrName: string;
  displayMode: 'color' | 'image' | 'text';
  value: string;    // hex color | image URL | plain text
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Normalise whatever lands in the DTO into VariantAttributeEntry[].
 * Handles:
 *   1. New array shape  (VariantAttributeEntry[])
 *   2. Legacy object    { Color: '#ff0000', Size: 'S' }
 *   3. null / undefined → []
 */
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

/** Returns true only for a proper v4 UUID string. */
const isUuid = (val: unknown): val is string =>
  typeof val === 'string' &&
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(val);

/**
 * Generate every attribute combination from the **DTO** attributes.
 *
 * ⚠️  Must run from DTO data (before any DB save) because TypeORM does NOT
 * auto-populate `.variants` on an entity right after `save()`.
 *
 * With the real payload above (2 colors × 5 sizes) → 10 combinations.
 */
function generateCombinationsFromDto(
  attributes: AttributeDto[],
  defaultPrice: number,
): Array<{ attributes: VariantAttributeEntry[]; price: number; stock: number; autoGenerate: boolean }> {
  if (!attributes?.length) return [];

  const combinations: VariantAttributeEntry[][] = [];

  const recurse = (current: VariantAttributeEntry[], attrIndex: number) => {
    if (attrIndex === attributes.length) {
      combinations.push([...current]);
      return;
    }

    const attr = attributes[attrIndex];
    const displayMode: VariantAttributeEntry['displayMode'] =
      attr.type === 'color'
        ? ((attr.displayMode ?? 'color') as 'color' | 'image')
        : 'text';

    for (const variant of attr.variants ?? []) {
      recurse(
        [
          ...current,
          {
            attrId: '',          // no DB id at generation time
            attrName: attr.name,
            displayMode,
            value: variant.value,
          },
        ],
        attrIndex + 1,
      );
    }
  };

  recurse([], 0);

  return combinations.map((attrs) => ({
    attributes: attrs,
    price: -1,
    stock: 0,
    autoGenerate: true,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,

    @InjectRepository(Attribute)
    private attributeRepository: Repository<Attribute>,

    @InjectRepository(Variant)
    private variantRepository: Repository<Variant>,

    @InjectRepository(VariantDetail)
    private variantDetailRepository: Repository<VariantDetail>,

    @InjectRepository(Offer)
    private offerRepository: Repository<Offer>,

    @InjectRepository(ImageProduct)
    private imageProductRepository: Repository<ImageProduct>,

    private readonly storeService: StoreService,
    private readonly dataSource: DataSource,
  ) { }

  // ══════════════════════════════════════════════════════════════════════════
  // CREATE
  // ══════════════════════════════════════════════════════════════════════════

  async create(storeId: string, userId: string, dto: CreateProductDto): Promise<Product> {
    await this.storeService.verifyOwnership(storeId, userId);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // ── 1. Product ──────────────────────────────────────────────────────
      const product = this.productRepository.create({
        name: dto.name,
        desc: dto.desc,
        price: dto.price,
        priceOriginal: dto.priceOriginal,
        productImage: dto.productImage,
        sku: dto.sku,
        slug: dto.slug,
        stock: dto.stock ?? 0,
        isActive: dto.isActive ?? true,
        store: { id: storeId },
        category: dto.categoryId ? { id: dto.categoryId } : undefined,
      });
      const savedProduct = await queryRunner.manager.save(product);

      // ── 2. Attributes + Variants ────────────────────────────────────────
      if (dto.attributes?.length) {
        for (const attrDto of dto.attributes) {
          const attribute = this.attributeRepository.create({
            name: attrDto.name,
            type: attrDto.type,
            displayMode: attrDto.displayMode,
            product: savedProduct,
          });
          const savedAttribute = await queryRunner.manager.save(attribute);

          for (const varDto of attrDto.variants ?? []) {
            await queryRunner.manager.save(
              this.variantRepository.create({
                name: varDto.name,
                value: varDto.value,
                attribute: savedAttribute,
              }),
            );
          }
        }
      }

      // ── 3. Variant Details ──────────────────────────────────────────────
      //
      // Priority:
      //   a) Front-end sent explicit variantDetails  → use them as-is.
      //   b) variantDetails is empty AND attributes exist
      //      → auto-generate ALL combinations from DTO attributes NOW
      //        (cannot use saved entities – relations not loaded after save).
      //
      let vdList: any[] = dto.variantDetails ?? [];

      if (vdList.length === 0 && dto.attributes?.length) {
        vdList = generateCombinationsFromDto(dto.attributes, dto.price);
        console.log(`[Auto-generate] ${vdList.length} variant combinations saved`);
      }

      for (const vdDto of vdList) {
        // Explicit DTO → vdDto.attributes (VariantAttributeEntry[])
        // Auto-generated  → vdDto.attributes (same shape, built above)
        const namePayload = normaliseVDName(vdDto.attributes ?? vdDto.name ?? null);

        await queryRunner.manager.save(
          this.variantDetailRepository.create({
            name: namePayload,
            price: Number(vdDto.price) || dto.price,
            stock: Number(vdDto.stock) || 0,
            autoGenerate: vdDto.autoGenerate ?? false,
            product: savedProduct,
          } as any),
        );
      }

      // ── 4. Offers ───────────────────────────────────────────────────────
      for (const offerDto of dto.offers ?? []) {
        await queryRunner.manager.save(
          this.offerRepository.create({
            // ids like "off-1234" are not UUIDs → let Postgres generate
            name: offerDto.name,
            quantity: Number(offerDto.quantity),
            price: Number(offerDto.price),
            product: savedProduct,
          }),
        );
      }

      // ── 5. Images ───────────────────────────────────────────────────────
      for (const imageUrl of dto.images ?? []) {
        await queryRunner.manager.save(
          this.imageProductRepository.create({ imageUrl, product: savedProduct }),
        );
      }

      await queryRunner.commitTransaction();
      return this.findOne(savedProduct.id, storeId, userId);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('Error creating product:', error);
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
    await this.storeService.verifyOwnership(storeId, userId);

    const qb = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.imagesProduct', 'images')
      .leftJoinAndSelect('product.attributes', 'attributes')
      .leftJoinAndSelect('attributes.variants', 'variants')
      .where('product.storeId = :storeId', { storeId });

    if (categoryId) qb.andWhere('product.categoryId = :categoryId', { categoryId });
    if (search) qb.andWhere('(product.name ILIKE :search OR product.desc ILIKE :search)', { search: `%${search}%` });
    if (isActive !== undefined) qb.andWhere('product.isActive = :isActive', { isActive });

    qb.orderBy('product.createdAt', 'DESC').skip((page - 1) * limit).take(limit);

    const [products, total] = await qb.getManyAndCount();
    return { products, total, page, totalPages: Math.ceil(total / limit) };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FIND ONE
  // ══════════════════════════════════════════════════════════════════════════

  async findOne(id: string, storeId: string, userId?: string): Promise<Product> {
    if (userId) await this.storeService.verifyOwnership(storeId, userId);

    const product = await this.productRepository.findOne({
      where: { id, store: { id: storeId } },
      relations: [
        'category', 'imagesProduct',
        'attributes', 'attributes.variants',
        'variantDetails', 'offers',
      ],
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

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Basic fields
      Object.assign(product, {
        name: dto.name ?? product.name,
        desc: dto.desc ?? product.desc,
        price: dto.price !== undefined ? Number(dto.price) : product.price,
        priceOriginal: dto.priceOriginal !== undefined ? Number(dto.priceOriginal) : product.priceOriginal,
        productImage: dto.productImage ?? product.productImage,
        sku: dto.sku ?? product.sku,
        slug: dto.slug ?? product.slug,
        stock: dto.stock !== undefined ? Number(dto.stock) : product.stock,
        isActive: dto.isActive ?? product.isActive,
        category: dto.categoryId ? { id: dto.categoryId } : product.category,
      });
      await queryRunner.manager.save(product);

      // 2. Attributes (delete-then-recreate)
      if (dto.attributes) {
        await queryRunner.manager.delete(Attribute, { product: { id } });
        for (const attrDto of dto.attributes) {
          const attribute = this.attributeRepository.create({
            id: isUuid(attrDto.id) ? attrDto.id : undefined,
            name: attrDto.name,
            type: attrDto.type,
            displayMode: attrDto.displayMode,
            product,
          });
          const savedAttribute = await queryRunner.manager.save(attribute);

          for (const varDto of attrDto.variants ?? []) {
            await queryRunner.manager.save(
              this.variantRepository.create({
                id: isUuid(varDto.id) ? varDto.id : undefined,
                name: varDto.name,
                value: varDto.value,
                attribute: savedAttribute,
              }),
            );
          }
        }
      }

      // 3. Images (delete-then-recreate)
      if (dto.images) {
        await queryRunner.manager.delete(ImageProduct, { product: { id } });
        for (const imgUrl of dto.images) {
          await queryRunner.manager.save(
            this.imageProductRepository.create({ imageUrl: imgUrl, product }),
          );
        }
      }

      // 4. Variant Details (delete-then-recreate)
      if (dto.variantDetails !== undefined) {
        // ⚠️  orders.variantDetailId is a FK into variant_details.
        // Postgres refuses to delete a variant_detail row while orders still reference it.
        // Null-out the FK on any affected orders first, inside the same transaction.
        await queryRunner.query(
          `UPDATE orders SET "variantDetailId" = NULL
           WHERE "variantDetailId" IN (
             SELECT id FROM variant_details WHERE "productId" = $1
           )`,
          [id],
        );

        await queryRunner.manager.delete(VariantDetail, { product: { id } });

        let vdList: any[] = dto.variantDetails;

        // Auto-generate if empty but new attributes provided
        if (vdList.length === 0 && dto.attributes?.length) {
          vdList = generateCombinationsFromDto(dto.attributes, dto.price ?? product.price);
        }

        for (const vdDto of vdList) {
          const namePayload = normaliseVDName(vdDto.attributes ?? vdDto.name ?? null);

          await queryRunner.manager.save(
            queryRunner.manager.create(VariantDetail, {
              name: namePayload,
              price: Number(vdDto.price) || product.price,
              stock: Number(vdDto.stock) || 0,
              autoGenerate: vdDto.autoGenerate ?? false,
              product,
            } as any),
          );
        }
      }

      // 5. Offers (delete-then-recreate)
      if (dto.offers) {
        // ⚠️  orders.offerId is a FK into product_offers.
        // Null it out on affected orders before deleting, same pattern as variantDetailId.
        await queryRunner.query(
          `UPDATE orders SET "offerId" = NULL
           WHERE "offerId" IN (
             SELECT id FROM product_offers WHERE "productId" = $1
           )`,
          [id],
        );

        await queryRunner.manager.delete(Offer, { product: { id } });
        for (const offerDto of dto.offers) {
          await queryRunner.manager.save(
            this.offerRepository.create({
              id: isUuid(offerDto.id) ? offerDto.id : undefined,
              name: offerDto.name,
              quantity: Number(offerDto.quantity),
              price: Number(offerDto.price),
              product,
            }),
          );
        }
      }

      await queryRunner.commitTransaction();
      return this.findOne(id, storeId, userId);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error('Update Error Detail:', error);
      throw error;
    } finally {
      await queryRunner.release();
    }
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
    } catch (error) {
      console.error('Soft Delete Error:', error);
      throw new InternalServerErrorException('فشل حذف المنتج من قاعدة البيانات');
    }
  }

  async forceRemove(id: string, storeId: string, userId: string): Promise<{ message: string }> {
    await this.storeService.verifyOwnership(storeId, userId);
    const product = await this.productRepository.findOne({
      where: { id, store: { id: storeId } },
      withDeleted: true,
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
      where: { id, store: { id: storeId } },
      withDeleted: true,
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
    product.isActive = !product.isActive;
    await this.productRepository.save(product);
    return product;
  }

  async updateStock(id: string, storeId: string, userId: string, quantity: number): Promise<Product> {
    await this.storeService.verifyOwnership(storeId, userId);
    const product = await this.findOne(id, storeId, userId);
    if (quantity < 0) throw new BadRequestException('الكمية يجب أن تكون موجبة');
    product.stock = quantity;
    await this.productRepository.save(product);
    return product;
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
      totalProducts,
      activeProducts,
      inactiveProducts: totalProducts - activeProducts,
      outOfStock,
      totalValue: totalValue?.total || 0,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PUBLIC (Domain-based)
  // ══════════════════════════════════════════════════════════════════════════

  async findAllByDomain(
    subdomain: string,
    page = 1,
    limit = 20,
    categoryId?: string,
    search?: string,
  ): Promise<{ products: Product[]; total: number; page: number; totalPages: number }> {
    const qb = this.productRepository
      .createQueryBuilder('product')
      .innerJoin('product.store', 'store')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.imagesProduct', 'images')
      .leftJoinAndSelect('product.attributes', 'attributes')
      .leftJoinAndSelect('attributes.variants', 'variants')
      .where('store.subdomain = :subdomain', { subdomain })
      .andWhere('product.isActive = :isActive', { isActive: true })
      .andWhere('product.deletedAt IS NULL');

    if (categoryId) qb.andWhere('product.categoryId = :categoryId', { categoryId });
    if (search) qb.andWhere('(product.name ILIKE :search OR product.desc ILIKE :search)', { search: `%${search}%` });

    qb.orderBy('product.createdAt', 'DESC').skip((page - 1) * limit).take(limit);

    const [products, total] = await qb.getManyAndCount();
    return { products, total, page, totalPages: Math.ceil(total / limit) };
  }

  async findOneByDomain(subdomain: string, productId: string): Promise<any> {
    const product = await this.productRepository.findOne({
      where: [
        { id: productId, isActive: true, store: { subdomain } },
        { slug: productId, isActive: true, store: { subdomain } },
      ],
      relations: [
        'store',
        'store.themeUser',       // جلب سجل امتلاك الثيم الخاص بالمتجر
        'store.themeUser.theme', // جلب بيانات الثيم (الاسم، التصميم)
        'store.user',
        'category',
        'imagesProduct',
        'attributes',
        'attributes.variants',
        'variantDetails',
        'offers',
      ],
      order: { attributes: { id: 'ASC' } },
    });

    if (!product) throw new NotFoundException('المنتج غير موجود في هذا المتجر');

    return {
      ...product,
      store: product.store
        ? {
          id: product.store.id,
          name: product.store.name,
          subdomain: product.store.subdomain,
          userId: product.store.user.id,
          // 💡 إضافة بيانات الثيم هنا لكي تظهر في الـ Frontend
          theme: product.store.themeUser?.theme ? {
            id: product.store.themeUser.theme.id,
            slug: product.store.themeUser.theme.slug,
            name: product.store.themeUser.theme.name_en
          } : null,
        }
        : null,
      category: product.category
        ? { id: product.category.id, name: product.category.name }
        : null,
    };
  }

  async getVariants(productId: string) {
    return this.variantDetailRepository.find({
      where: { product: { id: productId } },
    });
  }

  async getOffers(productId: string) {
    return this.offerRepository.find({
      where: { product: { id: productId } },
    });
  }
}