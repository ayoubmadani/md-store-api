import {
  Injectable, NotFoundException,
  BadRequestException, InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Like } from 'typeorm';
import { Category } from './entities/category.entity';
import { Product } from '../product/entities/product.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { StoreService } from '../store/store.service';
import { QueryProductsDto } from './dto/query-products.dto';

@Injectable()
export class CategoryService {
  constructor(
    @InjectRepository(Category)
    private categoryRepository: Repository<Category>,
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private readonly storeService: StoreService,
  ) { }

  // ==================== Recursive CTE: جلب IDs الأبناء ====================

  private async findDescendantIds(categoryId: string): Promise<string[]> {
    const rows = await this.categoryRepository.query(
      `WITH RECURSIVE descendants AS (
         SELECT id FROM categories WHERE id = $1 AND "deletedAt" IS NULL
         UNION ALL
         SELECT c.id FROM categories c
         INNER JOIN descendants d ON c."parentId" = d.id
         WHERE c."deletedAt" IS NULL
       )
       SELECT id FROM descendants`,
      [categoryId],
    );
    return rows.map((r: any) => r.id);
  }

  // فحص إذا كان nodeId ابناً لـ ancestorId (لمنع الحلقة الدائرية)
  private async isDescendantOf(nodeId: string, ancestorId: string): Promise<boolean> {
    const ids = await this.findDescendantIds(ancestorId);
    return ids.includes(nodeId);
  }

  // ==================== إنشاء تصنيف ====================

  // ==================== إنشاء تصنيف ====================

  async create(storeId: string, userId: string, dto: CreateCategoryDto): Promise<Category> {
    await this.storeService.verifyOwnership(storeId, userId);

    const existing = await this.categoryRepository.findOne({
      where: { name: dto.name, storeId },
    });
    if (existing) {
      throw new BadRequestException(`التصنيف "${dto.name}" موجود بالفعل في هذا المتجر`);
    }

    const { parentId, categoryNicheId, ...restDto } = dto;

    if (parentId) {
      const parentExists = await this.categoryRepository.findOne({
        where: { id: parentId, storeId },
      });
      if (!parentExists) throw new NotFoundException(`التصنيف الأب #${parentId} غير موجود`);
    }

    // 1. نقوم بالتحويل هنا عند الإنشاء مباشرة باستخدام "as unknown as Category"
    const category = this.categoryRepository.create({
      ...restDto,
      storeId,
      parentId: parentId ?? null,
      categoryNicheId: categoryNicheId ?? null,
    } as any) as unknown as Category;

    try {
      // 2. الآن TypeORM سيعلم تلقائياً أن الناتج كائن مفرد وليس مصفوفة
      const saved = await this.categoryRepository.save(category);
      return this.findOne(saved.id, storeId);
    } catch (error) {
      throw new InternalServerErrorException('فشل إنشاء التصنيف');
    }
  }

  // ==================== تحديث تصنيف ====================

  async update(id: string, storeId: string, userId: string, dto: UpdateCategoryDto): Promise<Category> {
    await this.storeService.verifyOwnership(storeId, userId);

    const category = await this.findOne(id, storeId);
    const { parentId, categoryNicheId, ...scalarFields } = dto;

    if (scalarFields.name && scalarFields.name !== category.name) {
      const existing = await this.categoryRepository.findOne({
        where: { name: scalarFields.name, storeId },
      });
      if (existing) throw new BadRequestException(`التصنيف "${scalarFields.name}" موجود بالفعل`);
    }

    const updatePayload: any = { ...scalarFields };

    if (parentId !== undefined) {
      if (parentId === null) {
        updatePayload.parentId = null;
      } else {
        if (parentId === id) throw new BadRequestException('لا يمكن جعل التصنيف أباً لنفسه');

        const parent = await this.categoryRepository.findOne({
          where: { id: parentId, storeId },
        });
        if (!parent) throw new NotFoundException(`التصنيف الأب #${parentId} غير موجود`);

        // فحص الحلقة الدائرية
        const isCircular = await this.isDescendantOf(parentId, id);
        if (isCircular) {
          throw new BadRequestException('لا يمكن جعل أحد الأبناء أباً لهذا التصنيف (حلقة دائرية)');
        }

        updatePayload.parentId = parentId;
      }
    } else {
      updatePayload.parentId = null;
    }

    if (categoryNicheId !== undefined) {
      updatePayload.categoryNicheId = categoryNicheId ?? null;
    }

    try {
      await this.categoryRepository.update(id, updatePayload);
      return this.findOne(id, storeId);
    } catch (error) {
      throw new InternalServerErrorException('فشل تحديث التصنيف');
    }
  }

  // ==================== جلب التصنيفات ====================

  // findAll و findTrees — احذف 'children' و 'parent' من relations
  async findAll(storeId: string, userId: string): Promise<Category[]> {
    await this.storeService.verifyOwnership(storeId, userId);
    const categories = await this.categoryRepository.find({
      where: { storeId },
      relations: ['categoryNiche'], // ← فقط categoryNiche
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
    return this.buildTree(categories);
  }

  async findTrees(storeId: string, userId: string): Promise<Category[]> {
    await this.storeService.verifyOwnership(storeId, userId);
    const categories = await this.categoryRepository.find({
      where: { storeId },
      relations: ['categoryNiche'], // ← فقط categoryNiche
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
    return this.buildTree(categories);
  }

  async findOne(id: string, storeId: string, userId?: string): Promise<Category> {
    if (userId) await this.storeService.verifyOwnership(storeId, userId);
    const category = await this.categoryRepository.findOne({
      where: { id, storeId },
      relations: ['children', 'parent', 'categoryNiche'],
    });
    if (!category) throw new NotFoundException(`التصنيف #${id} غير موجود`);
    return category;
  }

  // ==================== حذف (soft + cascade أبناء) ====================

  async remove(id: string, storeId: string, userId: string): Promise<{ message: string }> {
    await this.storeService.verifyOwnership(storeId, userId);

    const category = await this.categoryRepository.findOne({
      where: { id, storeId },
      relations: ['products'],
    });
    if (!category) throw new NotFoundException(`التصنيف #${id} غير موجود`);

    if (category.products?.length > 0) {
      throw new BadRequestException(
        `لا يمكن حذف التصنيف، يحتوي على ${category.products.length} منتج/منتجات`,
      );
    }

    // جلب IDs جميع الأبناء
    const descendantIds = await this.findDescendantIds(id);

    // التحقق من عدم وجود منتجات في الأبناء
    const childIds = descendantIds.filter(did => did !== id);
    if (childIds.length > 0) {
      const productsCount = await this.productRepository.count({
        where: { category: { id: In(childIds) } },
      });
      if (productsCount > 0) {
        throw new BadRequestException(
          `لا يمكن الحذف، التصنيفات الفرعية تحتوي على ${productsCount} منتج/منتجات`,
        );
      }
    }

    try {
      // soft delete للجميع
      await this.categoryRepository
        .createQueryBuilder()
        .softDelete()
        .where('id IN (:...ids)', { ids: descendantIds })
        .execute();

      return {
        message: childIds.length > 0
          ? `تم حذف التصنيف و${childIds.length} تصنيف/تصنيفات فرعية بنجاح`
          : 'تم حذف التصنيف بنجاح',
      };
    } catch {
      throw new InternalServerErrorException('فشل حذف التصنيف');
    }
  }

  async forceRemove(id: string, storeId: string, userId: string): Promise<{ message: string }> {
    await this.storeService.verifyOwnership(storeId, userId);
    const category = await this.categoryRepository.findOne({
      where: { id, storeId },
      withDeleted: true,
    });
    if (!category) throw new NotFoundException(`التصنيف #${id} غير موجود`);
    try {
      await this.categoryRepository.delete(id);
      return { message: 'تم حذف التصنيف نهائياً' };
    } catch {
      throw new InternalServerErrorException('فشل الحذف النهائي');
    }
  }

  async restore(id: string, storeId: string, userId: string): Promise<Category> {
    await this.storeService.verifyOwnership(storeId, userId);
    const category = await this.categoryRepository.findOne({
      where: { id, storeId },
      withDeleted: true,
    });
    if (!category) throw new NotFoundException(`التصنيف #${id} غير موجود`);
    if (!category.deletedAt) throw new BadRequestException('التصنيف غير محذوف');
    try {
      await this.categoryRepository.restore(id);
      return this.findOne(id, storeId);
    } catch {
      throw new InternalServerErrorException('فشل استعادة التصنيف');
    }
  }

  // ==================== منتجات التصنيف وأبنائه ====================

  async getCategoryProductsRecursive(
    categoryId: string, storeId: string, userId: string,
    queryDto: QueryProductsDto = {},
  ) {
    await this.storeService.verifyOwnership(storeId, userId);

    const category = await this.categoryRepository.findOne({
      where: { id: categoryId, storeId },
    });
    if (!category) throw new NotFoundException(`التصنيف #${categoryId} غير موجود`);

    const { page = 1, limit = 20, search, sortBy = 'createdAt', sortOrder = 'DESC' } = queryDto;
    const categoryIds = await this.findDescendantIds(categoryId);

    const whereCondition: any = {
      category: { id: In(categoryIds) },
      store: { id: storeId },
      isActive: true,
    };
    if (search) whereCondition.name = Like(`%${search}%`);

    const [products, total] = await this.productRepository.findAndCount({
      where: whereCondition,
      relations: ['category', 'images'],
      order: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { products, total, page, totalPages: Math.ceil(total / limit), categoryName: category.name };
  }

  // ==================== إحصائيات ====================

  async getStats(id: string, storeId: string, userId: string) {
    await this.storeService.verifyOwnership(storeId, userId);
    const category = await this.categoryRepository.findOne({
      where: { id, storeId },
      relations: ['products'],
    });
    if (!category) throw new NotFoundException(`التصنيف #${id} غير موجود`);

    const descendantIds = await this.findDescendantIds(id);
    const childIds = descendantIds.filter(did => did !== id);

    const totalProducts = await this.productRepository.count({
      where: { category: { id: In(descendantIds) }, isActive: true },
    });
    const activeProducts = await this.productRepository.count({
      where: { category: { id: category.id }, isActive: true },
    });

    return {
      categoryId: category.id,
      categoryName: category.name,
      directProducts: category.products?.length || 0,
      activeProducts,
      totalSubcategories: childIds.length,
      totalProducts,
      isActive: category.isActive,
      createdAt: category.createdAt,
    };
  }

  // ==================== نقل المنتجات ====================

  async moveProducts(fromCategoryId: string, toCategoryId: string, storeId: string, userId: string) {
    await this.storeService.verifyOwnership(storeId, userId);
    const toCategory = await this.findOne(toCategoryId, storeId);
    const products = await this.productRepository.find({
      where: { category: { id: fromCategoryId }, store: { id: storeId } },
    });
    if (products.length === 0) throw new BadRequestException('لا توجد منتجات لنقلها');
    await this.productRepository.update(
      { category: { id: fromCategoryId } },
      { category: toCategory },
    );
    return { message: `تم نقل ${products.length} منتج/منتجات بنجاح`, movedCount: products.length };
  }

  // ==================== البحث ====================

  async search(storeId: string, userId: string, searchTerm: string): Promise<Category[]> {
    await this.storeService.verifyOwnership(storeId, userId);
    if (!searchTerm?.trim()) return this.findAll(storeId, userId);
    const results = await this.categoryRepository.find({
      where: [
        { name: Like(`%${searchTerm}%`), storeId },
        { description: Like(`%${searchTerm}%`), storeId },
      ],
      relations: ['parent', 'children', 'categoryNiche'],
      order: { name: 'ASC' },
    });
    return results;
  }

  // ==================== بناء الشجرة ====================

  private buildTree(categories: Category[]): Category[] {
  const map = new Map<string, Category>();
  const roots: Category[] = [];

  // إنشاء خريطة مع reset للأبناء
  categories.forEach(cat => map.set(cat.id, { ...cat, children: [] }));

  // ربط كل تصنيف بأبيه عبر parentId
  categories.forEach(cat => {
    const node = map.get(cat.id)!;
    if (cat.parentId && map.has(cat.parentId)) {
      const parent = map.get(cat.parentId)!;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}
}