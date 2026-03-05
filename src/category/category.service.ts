import { 
  Injectable, 
  NotFoundException, 
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { TreeRepository, In, Repository, Like } from 'typeorm';
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
    private categoryRepository: TreeRepository<Category>,
    
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    
    private readonly storeService: StoreService,
  ) {}

  // ==================== جلب منتجات التصنيف وأبنائه (مع Pagination) ====================

  /**
   * عند الضغط على تصنيف (مثل Home)، نجلب جميع منتجاته ومنتجات الأقسام التابعة له
   */
  async getCategoryProductsRecursive(
    categoryId: string,
    storeId: string,
    userId: string,
    queryDto: QueryProductsDto = {}
  ): Promise<{
    products: Product[];
    total: number;
    page: number;
    totalPages: number;
    categoryName: string;
  }> {
    // التحقق من الملكية
    await this.storeService.verifyOwnership(storeId, userId);

    const { page = 1, limit = 20, search, sortBy = 'createdAt', sortOrder = 'DESC' } = queryDto;

    // التأكد من وجود التصنيف
    const category = await this.categoryRepository.findOne({
      where: { id: categoryId, store: { id: storeId } }
    });

    if (!category) {
      throw new NotFoundException(`التصنيف #${categoryId} غير موجود`);
    }

    // جلب كل الأبناء والأحفاد
    const descendants = await this.categoryRepository.findDescendants(category);
    const categoryIds = descendants.map(cat => cat.id);

    // بناء شروط البحث
    const whereCondition: any = {
      category: { id: In(categoryIds) },
      store: { id: storeId },
      isActive: true,
    };

    // إضافة البحث النصي إذا وُجد
    if (search) {
      whereCondition.name = Like(`%${search}%`);
    }

    // جلب المنتجات مع العد
    const [products, total] = await this.productRepository.findAndCount({
      where: whereCondition,
      relations: ['category', 'images'],
      order: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      products,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      categoryName: category.name,
    };
  }

  // ==================== إنشاء تصنيف جديد ====================

  async create(storeId: string, userId: string, dto: CreateCategoryDto): Promise<Category> {
    await this.storeService.verifyOwnership(storeId, userId);

    // التحقق من عدم تكرار الاسم في نفس المتجر
    const existingCategory = await this.categoryRepository.findOne({
      where: { 
        name: dto.name, 
        store: { id: storeId },
      }
    });

    if (existingCategory) {
      throw new BadRequestException(`التصنيف "${dto.name}" موجود بالفعل في هذا المتجر`);
    }

    const category = this.categoryRepository.create({
      ...dto,
      store: { id: storeId },
    });

    // إضافة التصنيف الأب إذا وُجد
    if (dto.parentId) {
      const parent = await this.findOne(dto.parentId, storeId);
      category.parent = parent;
    }

    try {
      return await this.categoryRepository.save(category);
    } catch (error) {
      throw new InternalServerErrorException('فشل إنشاء التصنيف');
    }
  }

  // ==================== جلب جميع التصنيفات كقائمة مسطحة ====================

  async findAll(storeId: string, userId: string): Promise<Category[]> {
    await this.storeService.verifyOwnership(storeId, userId);

    const categories = await this.categoryRepository.find({
      where: { store: { id: storeId } },
      relations: ['children', 'parent'],
      order: { sortOrder: 'ASC', name: 'ASC' },
    });

    return this.buildTree(categories);
  }

  // ==================== جلب التصنيفات كشجرة هرمية ====================

  async findTrees(storeId: string, userId: string): Promise<Category[]> {
    await this.storeService.verifyOwnership(storeId, userId);

    // جلب جميع التصنيفات أولاً
    const allCategories = await this.categoryRepository.find({
      where: { store: { id: storeId } },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });

    // بناء الشجرة يدوياً
    return this.buildTree(allCategories);
  }

  // ==================== جلب تصنيف واحد ====================

  async findOne(id: string, storeId: string, userId?: string): Promise<Category> {
    if (userId) {
      await this.storeService.verifyOwnership(storeId, userId);
    }

    const category = await this.categoryRepository.findOne({
      where: { id, store: { id: storeId } },
      relations: ['children', 'parent'],
    });

    if (!category) {
      throw new NotFoundException(`التصنيف #${id} غير موجود`);
    }

    return category;
  }

  // ==================== تحديث تصنيف ====================

  async update(
    id: string, 
    storeId: string, 
    userId: string, 
    dto: UpdateCategoryDto
  ): Promise<Category> {
    await this.storeService.verifyOwnership(storeId, userId);
    const category = await this.findOne(id, storeId);

    // التحقق من عدم تكرار الاسم إذا تم تغييره
    if (dto.name && dto.name !== category.name) {
      const existingCategory = await this.categoryRepository.findOne({
        where: { 
          name: dto.name, 
          store: { id: storeId },
        }
      });

      if (existingCategory) {
        throw new BadRequestException(`التصنيف "${dto.name}" موجود بالفعل`);
      }
    }

    // تحديث البيانات
    Object.assign(category, dto);

    // تحديث التصنيف الأب
    if (dto.parentId !== undefined) {
      if (dto.parentId === null) {
        category.parent = null;
      } else {
        if (dto.parentId === id) {
          throw new BadRequestException('لا يمكن جعل التصنيف أباً لنفسه');
        }

        // التحقق من عدم إنشاء حلقة دائرية
        const parent = await this.findOne(dto.parentId, storeId);
        const parentAncestors = await this.categoryRepository.findAncestors(parent);
        
        if (parentAncestors.some(ancestor => ancestor.id === id)) {
          throw new BadRequestException('لا يمكن جعل أحد الأبناء أباً لهذا التصنيف (حلقة دائرية)');
        }

        category.parent = parent;
      }
    }

    try {
      return await this.categoryRepository.save(category);
    } catch (error) {
      throw new InternalServerErrorException('فشل تحديث التصنيف');
    }
  }

  // ==================== حذف تصنيف (Soft Delete) ====================

  async remove(id: string, storeId: string, userId: string): Promise<{ message: string }> {
    await this.storeService.verifyOwnership(storeId, userId);
    const category = await this.categoryRepository.findOne({
      where: { id, store: { id: storeId } },
      relations: ['products'],
    });

    if (!category) {
      throw new NotFoundException(`التصنيف #${id} غير موجود`);
    }

    // التحقق من عدم وجود منتجات
    if (category.products?.length > 0) {
      throw new BadRequestException(
        `لا يمكن حذف التصنيف، يحتوي على ${category.products.length} منتج/منتجات`
      );
    }

    // التحقق من عدم وجود تصنيفات فرعية
    const childrenCount = await this.categoryRepository.countDescendants(category);
    if (childrenCount > 1) {
      throw new BadRequestException(
        `لا يمكن حذف التصنيف، يحتوي على ${childrenCount - 1} تصنيف/تصنيفات فرعية`
      );
    }

    try {
      await this.categoryRepository.softRemove(category);
      return { message: 'تم حذف التصنيف بنجاح' };
    } catch (error) {
      throw new InternalServerErrorException('فشل حذف التصنيف');
    }
  }

  // ==================== الحذف النهائي (للأدمن فقط) ====================

  async forceRemove(id: string, storeId: string, userId: string): Promise<{ message: string }> {
    await this.storeService.verifyOwnership(storeId, userId);
    const category = await this.categoryRepository.findOne({
      where: { id, store: { id: storeId } },
      withDeleted: true, // جلب حتى المحذوفة
    });

    if (!category) {
      throw new NotFoundException(`التصنيف #${id} غير موجود`);
    }

    try {
      await this.categoryRepository.remove(category);
      return { message: 'تم حذف التصنيف نهائياً' };
    } catch (error) {
      throw new InternalServerErrorException('فشل الحذف النهائي');
    }
  }

  // ==================== استعادة تصنيف محذوف ====================

  async restore(id: string, storeId: string, userId: string): Promise<Category> {
    await this.storeService.verifyOwnership(storeId, userId);
    
    const category = await this.categoryRepository.findOne({
      where: { id, store: { id: storeId } },
      withDeleted: true,
    });

    if (!category) {
      throw new NotFoundException(`التصنيف #${id} غير موجود`);
    }

    if (!category.deletedAt) {
      throw new BadRequestException('التصنيف غير محذوف');
    }

    try {
      await this.categoryRepository.recover(category);
      return category;
    } catch (error) {
      throw new InternalServerErrorException('فشل استعادة التصنيف');
    }
  }

  // ==================== بناء شجرة التصنيفات ====================

  private buildTree(categories: Category[]): Category[] {
    const map = new Map<string, Category>();
    const roots: Category[] = [];

    // إنشاء خريطة من التصنيفات
    categories.forEach(cat => {
      map.set(cat.id, { ...cat, children: [] });
    });

    // بناء الشجرة
    categories.forEach(cat => {
      const node = map.get(cat.id);
      if (!node) return; // تحقق من وجود العقدة
      
      if (cat.parent && cat.parent.id && map.has(cat.parent.id)) {
        const parent = map.get(cat.parent.id);
        if (parent) {
          if (!parent.children) {
            parent.children = [];
          }
          parent.children.push(node);
        }
      } else {
        roots.push(node);
      }
    });

    return roots;
  }

  // ==================== إحصائيات التصنيف ====================

  async getStats(id: string, storeId: string, userId: string) {
    await this.storeService.verifyOwnership(storeId, userId);
    
    const category = await this.categoryRepository.findOne({
      where: { id, store: { id: storeId } },
      relations: ['products'],
    });

    if (!category) {
      throw new NotFoundException(`التصنيف #${id} غير موجود`);
    }

    // جلب جميع الأبناء
    const descendants = await this.categoryRepository.findDescendants(category);
    const categoryIds = descendants.map(cat => cat.id);

    // عد المنتجات في جميع التصنيفات الفرعية
    const totalProducts = await this.productRepository.count({
      where: { 
        category: { id: In(categoryIds) },
        isActive: true,
      }
    });

    // عد المنتجات النشطة فقط في هذا التصنيف
    const activeProducts = await this.productRepository.count({
      where: { 
        category: { id: category.id },
        isActive: true,
      }
    });

    return {
      categoryId: category.id,
      categoryName: category.name,
      directProducts: category.products?.length || 0,
      activeProducts,
      totalSubcategories: descendants.length - 1,
      totalProducts,
      isActive: category.isActive,
      createdAt: category.createdAt,
    };
  }

  // ==================== نقل المنتجات بين التصنيفات ====================

  async moveProducts(
    fromCategoryId: string,
    toCategoryId: string,
    storeId: string,
    userId: string
  ): Promise<{ message: string; movedCount: number }> {
    await this.storeService.verifyOwnership(storeId, userId);

    // التحقق من التصنيفات
    const fromCategory = await this.findOne(fromCategoryId, storeId);
    const toCategory = await this.findOne(toCategoryId, storeId);

    // جلب المنتجات
    const products = await this.productRepository.find({
      where: { 
        category: { id: fromCategoryId },
        store: { id: storeId },
      }
    });

    if (products.length === 0) {
      throw new BadRequestException('لا توجد منتجات لنقلها');
    }

    // تحديث التصنيف لجميع المنتجات
    await this.productRepository.update(
      { category: { id: fromCategoryId } },
      { category: toCategory }
    );

    return {
      message: `تم نقل ${products.length} منتج/منتجات بنجاح`,
      movedCount: products.length,
    };
  }

  // ==================== البحث في التصنيفات ====================

  async search(
    storeId: string,
    userId: string,
    searchTerm: string
  ): Promise<Category[]> {
    await this.storeService.verifyOwnership(storeId, userId);

    if (!searchTerm || searchTerm.trim().length === 0) {
      return this.findAll(storeId, userId);
    }

    return this.categoryRepository.find({
      where: [
        { 
          name: Like(`%${searchTerm}%`),
          store: { id: storeId },
        },
        { 
          description: Like(`%${searchTerm}%`),
          store: { id: storeId },
        },
      ],
      relations: ['parent', 'children'],
      order: { name: 'ASC' },
    });
  }
}