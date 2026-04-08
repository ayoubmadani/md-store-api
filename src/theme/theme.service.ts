import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateThemeDto } from './dto/create-theme.dto';
import { UpdateThemeDto } from './dto/update-theme.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Theme } from './entities/theme.entity';
import { ArrayContains, DataSource, FindOptionsWhere, ILike, Repository } from 'typeorm';
import { TypeThemeService } from './type-theme.service';
import { ThemeUser } from './entities/theme-user.entity';
import { Store } from '../store/entities/store.entity';
import { PaymentService } from '../payment/payment.service';
import { TransactionType } from '../payment/entities/transaction.entity';

@Injectable()
export class ThemeService {

  constructor(
    @InjectRepository(Theme) private readonly themeRepo: Repository<Theme>,
    @InjectRepository(ThemeUser) private readonly themeUserRepo: Repository<ThemeUser>,
    @InjectRepository(Store) private readonly storeRepo: Repository<Store>,

    private readonly paymentService: PaymentService,
    private readonly dataSource: DataSource,

  ) { }


  async create(dto: CreateThemeDto[]) {
    // نقوم بإنشاء الكيانات (Entities) من المصفوفة
    const newThemes = this.themeRepo.create(dto);

    // حفظ الكل دفعة واحدة في قاعدة البيانات
    return await this.themeRepo.save(newThemes);
  }

  async findAll(query?: string, typeId?: string, page: number = 1, limit: number = 10, isAdmin: boolean = false) {
    const skip = (page - 1) * Number(limit);

    // 1. تنظيف المدخلات
    const searchQuery = (query && query !== 'undefined') ? query.trim() : null;
    const filterType = (typeId && typeId !== 'undefined' as any) ? typeId : null;

    // 2. القيد الأساسي: غير الأدمن يرى فقط الثيمات المفعّلة
    const activeFilter = isAdmin ? {} : { isActive: true };

    let whereCondition: any;

    // 3. بناء الشرط بناءً على المدخلات
    if (searchQuery) {
      const ilikeQuery = ILike(`%${searchQuery}%`);
      whereCondition = [
        { name_ar: ilikeQuery, ...(filterType && { typeId: filterType }), ...activeFilter },
        { name_en: ilikeQuery, ...(filterType && { typeId: filterType }), ...activeFilter },
        { desc_ar: ilikeQuery, ...(filterType && { typeId: filterType }), ...activeFilter },
      ];
    } else if (filterType) {
      whereCondition = { typeId: filterType, ...activeFilter };
    } else {
      whereCondition = { ...activeFilter };
    }

    // 4. التنفيذ
    const [data, total] = await this.themeRepo.findAndCount({
      where: whereCondition,
      relations: ['types'],
      take: Number(limit),
      skip,
      order: { id: 'DESC' },
    });

    return {
      data,
      meta: {
        totalItems: total,
        totalPages: Math.ceil(total / limit),
        currentPage: Number(page),
      },
    };
  }

  async findUserTheme(userId: string) {
    return this.themeRepo.find({
      where: { themeUsers: { userId } },
    })
  }

  async findAllth() {
    const getthemes = await this.themeRepo.find()

    const themes = getthemes.map(th => { return { name: th.name_en, desc: th.desc_en, slug: th.slug } })


    return themes
  }

  findOne(id: number) {
    return `This action returns a #${id} theme`;
  }

  async update(id: string, dto: UpdateThemeDto) {
    // 1. تنفيذ عملية التحديث مباشرة باستخدام الـ DTO
    // TypeORM سيقوم بتحديث الحقول المرسلة فقط (Partial Update)
    await this.themeRepo.update(id, dto);

    // 2. جلب الكائن المحدث لإرجاعه للـ Frontend (اختياري لكنه أفضل للـ React)
    const updatedTheme = await this.themeRepo.findOneBy({ id });

    if (!updatedTheme) {
      throw new NotFoundException(`Theme with ID ${id} not found`);
    }

    return updatedTheme;
  }

  remove(id: number) {
    return `This action removes a #${id} theme`;
  }

  async installTheme(themeId: string, userId: string) {
    // 1. التحقق من صحة المعرفات
    if (!themeId || !userId || themeId === 'undefined' || userId === 'undefined') {
      throw new BadRequestException('Invalid ID provided');
    }

    // 2. الحصول على الثيم والتأكد من وجوده ونشاطه
    const theme = await this.themeRepo.findOne({ where: { id: themeId } });
    if (!theme || !theme.isActive) {
      return this.res(false, 'Theme not found or not active');
    }

    // 3. التحقق مما إذا كان المستخدم يملك الثيم مسبقاً
    const alreadyOwned = await this.themeUserRepo.findOne({ where: { themeId, userId } });
    if (alreadyOwned) {
      return this.res(false, 'User already owns this theme');
    }

    // 4. تنفيذ عملية الشراء داخل Transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const price = Number(theme.price || 0);

      if (price > 0) {
        // --- التعديل هنا: استدعاء الدالة من الـ paymentService المحقون ---
        await this.paymentService.handleWalletBalance(  
          userId,
          price,
          "SUB",
          TransactionType.SELL_THEME,
          queryRunner.manager,
        );
      }

      // 5. منح الثيم للمستخدم باستخدام الـ manager لضمان الـ Transaction
      const newThemeUser = this.themeUserRepo.create({ userId, themeId });
      await queryRunner.manager.save(newThemeUser);

      // اعتماد كافة العمليات
      await queryRunner.commitTransaction();
      return this.res(true, 'Theme installed successfully');

    } catch (error) {
      // التراجع في حال حدوث خطأ (مثل نقص الرصيد)
      await queryRunner.rollbackTransaction();
      return this.res(false, error.message || 'Installation failed');
    } finally {
      await queryRunner.release();
    }
  }

  async activeTheme(userId, { themeId, storeId, isDefault }) {
    // 1. إذا كان المطلوب هو الثيم الافتراضي
    if (isDefault === true || !themeId) {
      await this.storeRepo.update(storeId, {
        themeUserId: null // مسح الثيم المخصص للعودة للافتراضي
      });
      return this.res(true, 'Default theme activated successfully');
    }

    // 2. إذا كان المطلوب ثيم مخصص، نتأكد من الملكية
    const themeUser = await this.themeUserRepo.findOne({
      where: { themeId, userId }
    });

    if (!themeUser) {
      return this.res(false, 'User does not own this theme');
    }

    // 3. تحديث المتجر بسجل الامتلاك
    await this.storeRepo.update(storeId, {
      themeUserId: themeUser.id // هنا themeUser مضمون الوجود
    });

    return this.res(true, 'Theme activated successfully');
  }

  // halper

  private res(success, message) {
    return { success, message }
  }
}
