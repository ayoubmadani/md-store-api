import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateThemeDto } from './dto/create-theme.dto';
import { UpdateThemeDto } from './dto/update-theme.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Theme } from './entities/theme.entity';
import { DataSource, ILike, Repository } from 'typeorm';
import { TypeThemeService } from './type-theme.service';
import { ThemeUser } from './entities/theme-user.entity';
import { ThemePlan } from './entities/theme-plan.entity';
import { Store } from '../store/entities/store.entity';
import { PaymentService } from '../payment/payment.service';
import { TransactionType } from '../payment/entities/transaction.entity';
import { Subscription } from '../subscription/entities/subscription.entity';

@Injectable()
export class ThemeService {

  constructor(
    @InjectRepository(Theme) private readonly themeRepo: Repository<Theme>,
    @InjectRepository(ThemeUser) private readonly themeUserRepo: Repository<ThemeUser>,
    @InjectRepository(ThemePlan) private readonly themePlanRepo: Repository<ThemePlan>,
    @InjectRepository(Store) private readonly storeRepo: Repository<Store>,
    @InjectRepository(Subscription) private readonly subRepo: Repository<Subscription>,

    private readonly paymentService: PaymentService,
    private readonly dataSource: DataSource,
  ) { }


  async create(dto: CreateThemeDto[]) {
    const newThemes = this.themeRepo.create(dto);
    return await this.themeRepo.save(newThemes);
  }

  async findAll(query?: string, typeId?: string, page: number = 1, limit: number = 10, isAdmin: boolean = false) {
    const skip = (page - 1) * Number(limit);

    const searchQuery = (query && query !== 'undefined') ? query.trim() : null;
    const filterType = (typeId && typeId !== 'undefined' as any) ? typeId : null;

    const activeFilter = isAdmin ? {} : { isActive: true };

    let whereCondition: any;

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

    const [data, total] = await this.themeRepo.findAndCount({
      where: whereCondition,
      relations: ['type'],
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
    });
  }

  async findAllth() {
    const getthemes = await this.themeRepo.find();
    return getthemes.map(th => ({ name: th.name_en, desc: th.desc_en, slug: th.slug }));
  }

  findOne(id: number) {
    return `This action returns a #${id} theme`;
  }

  async update(id: string, dto: UpdateThemeDto) {
    await this.themeRepo.update(id, dto);
    const updatedTheme = await this.themeRepo.findOneBy({ id });
    if (!updatedTheme) throw new NotFoundException(`Theme with ID ${id} not found`);
    return updatedTheme;
  }

  remove(id: number) {
    return `This action removes a #${id} theme`;
  }

  // ─────────────────────────────────────────────
  //  getPlanInfo — معلومات خطة المستخدم + الثيمات
  // ─────────────────────────────────────────────
async getPlanInfo(userId: string) {
    // 1. جلب اشتراك المستخدم النشط باستخدام الـ Repository لضمان التوافق مع Postgres
    const sub = await this.subRepo.findOne({
      where: { userId, status: 'active' },
      relations: ['plan'], // جلب بيانات الخطة المرتبطة
      order: { createdAt: 'DESC' }, // أو startDate حسب الموجود عندك
    });

    // 2. تجهيز المتغيرات الأساسية
    let planThemeIds: string[] = [];
    let planName = 'free';
    let planId: string | null = null;

    if (sub && sub.plan) {
      planId = sub.plan.id;
      planName = sub.plan.name ?? 'free';

      // جلب معرفات الثيمات المشمولة في هذه الخطة
      const planThemes = await this.themePlanRepo.find({
        where: { planId: planId },
        select: ['themeId']
      });

      planThemeIds = planThemes.map(tp => tp.themeId);
    }

    // 3. عدد الثيمات التي قام المستخدم بتثبيتها فعلياً
    const installedCount = await this.themeUserRepo.count({
      where: { userId }
    });

    // 4. إرجاع البيانات (تأكد من مطابقة أسماء الحقول في الـ Entity)
    return {
      plan: {
        id: planId,
        name: planName,
        monthlyPrice: sub?.plan?.monthlyPrice ?? 0,
        yearlyPrice: sub?.plan?.yearlyPrice ?? 0,
        interval: sub?.interval ?? null, // الحقل في Entity الاشتراك
        expiresAt: sub?.endDate ?? null, // الحقل في Entity الاشتراك
      },
      planThemeIds, 
      installedCount,
      isPaid: !!planId,
    };
  }

  async getThemePlan(userId:string){
    const sub = await this.subRepo.findOne({
      where: { userId, status: 'active' },
      relations: ['plan', 'plan.features'],
      order: { startDate: 'DESC' },
    });

    if (!sub) {
      throw new NotFoundException('')
    }
    
    return this.themeRepo.find({
      where: { themePlans : {plan : {id : sub.plan.id}} },
    });
  }

  async activeThemePlan(userId: string, data: { storeId: string; themeId: string }) {
    const { themeId, storeId } = data;
    
    const sub = await this.subRepo.findOne({
      where: { 
        userId, 
        status: 'active', 
        plan: { 
          themePlans: { themeId: themeId as any } // تأكد من مطابقة النوع هنا
        }
      },
      relations: ['plan', 'plan.themePlans'], // أضف themePlans للتأكد من التحقق العميق
      order: { createdAt: 'DESC' },
    });

    if (!sub) {
      throw new NotFoundException('هذا القالب غير مدرج في خطتك النشطة');
    }

    // التحديث
    await this.storeRepo.update(storeId, { themeId: themeId });
    
    return { message: 'تم تفعيل القالب بنجاح' };
}

  // ─────────────────────────────────────────────
  //  installTheme
  // ─────────────────────────────────────────────
  async installTheme(themeId: string, userId: string) {
    if (!themeId || !userId || themeId === 'undefined' || userId === 'undefined') {
      throw new BadRequestException('Invalid ID provided');
    }

    const theme = await this.themeRepo.findOne({ where: { id: themeId } });
    if (!theme || !theme.isActive) {
      return this.res(false, 'Theme not found or not active');
    }

    const alreadyOwned = await this.themeUserRepo.findOne({ where: { themeId, userId } });
    if (alreadyOwned) {
      return this.res(false, 'User already owns this theme');
    }

    // هل الثيم مضمّن في خطة المستخدم؟
    const planInfo = await this.getPlanInfo(userId);
    const isIncludedInPlan = planInfo.planThemeIds.includes(themeId);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const price = isIncludedInPlan ? 0 : Number(theme.price || 0);

      if (price > 0) {
        await this.paymentService.handleWalletBalance(
          userId,
          price,
          'SUB',
          TransactionType.SELL_THEME,
          queryRunner.manager,
        );
      }

      const newThemeUser = this.themeUserRepo.create({ userId, themeId });
      await queryRunner.manager.save(newThemeUser);

      await queryRunner.commitTransaction();
      return this.res(true, 'Theme installed successfully');

    } catch (error) {
      await queryRunner.rollbackTransaction();
      return this.res(false, error.message || 'Installation failed');
    } finally {
      await queryRunner.release();
    }
  }

  async activeTheme(userId, { themeId, storeId, isDefault }) {
    if (isDefault === true || !themeId) {
      await this.storeRepo.update(storeId, { themeUserId: null });
      return this.res(true, 'Default theme activated successfully');
    }

    const themeUser = await this.themeUserRepo.findOne({ where: { themeId, userId } });
    if (!themeUser) return this.res(false, 'User does not own this theme');

    await this.storeRepo.update(storeId, { themeId });
    return this.res(true, 'Theme activated successfully');
  }

  private res(success: boolean, message: string) {
    return { success, message };
  }
}