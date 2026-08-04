import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateThemeDto } from './dto/create-theme.dto';
import { UpdateThemeDto } from './dto/update-theme.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Theme } from './entities/theme.entity';
import { DataSource, ILike, In, Not, Repository } from 'typeorm';
import { TypeThemeService } from './type-theme.service';
import { ThemeUser } from './entities/theme-user.entity';
import { ThemePlan } from './entities/theme-plan.entity';
import { Store } from '../store/entities/store.entity';
import { PaymentService } from '../payment/payment.service';
import { TransactionType } from '../payment/entities/transaction.entity';
import { HIDDEN_TYPE_NAMES } from './theme.constants';
import { CouponService } from '../coupon/coupon.service';
import { CouponContext } from '../coupon/entities/coupon-redemption.entity';
import { SubscriptionService } from '../subscription/subscription.service';
import { log } from 'console';

@Injectable()
export class ThemeService {
  constructor(
    @InjectRepository(Theme) private readonly themeRepo: Repository<Theme>,
    @InjectRepository(ThemeUser) private readonly themeUserRepo: Repository<ThemeUser>,
    @InjectRepository(ThemePlan) private readonly themePlanRepo: Repository<ThemePlan>,
    @InjectRepository(Store) private readonly storeRepo: Repository<Store>,

    private readonly paymentService: PaymentService,
    private readonly dataSource: DataSource,
    private readonly couponService: CouponService,
    private readonly subscriptionService: SubscriptionService,
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
    const hiddenTypesFilter = isAdmin
      ? {}
      : { type: { name: Not(In(HIDDEN_TYPE_NAMES)) } };

    let whereCondition: any;

    if (searchQuery) {
      const ilikeQuery = ILike(`%${searchQuery}%`);
      whereCondition = [
        { name_ar: ilikeQuery, ...(filterType && { typeId: filterType }), ...activeFilter, ...hiddenTypesFilter },
        { name_en: ilikeQuery, ...(filterType && { typeId: filterType }), ...activeFilter, ...hiddenTypesFilter },
        { desc_ar: ilikeQuery, ...(filterType && { typeId: filterType }), ...activeFilter, ...hiddenTypesFilter },
      ];
    } else if (filterType) {
      whereCondition = { typeId: filterType, ...activeFilter, ...hiddenTypesFilter };
    } else {
      whereCondition = { ...activeFilter, ...hiddenTypesFilter };
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
    // ✅ findSub تعالج انتهاء الاشتراك أولاً (تجديد/رجوع للمجاني) قبل إرجاع النتيجة،
    // فلا يمكن أن يعتمد هذا على صف "active" قديم لم تتم معالجة انتهائه بعد.
    const sub = await this.subscriptionService.findSub(userId);

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
    // ✅ نفس السبب: findSub يضمن أن حالة الاشتراك محدّثة قبل التحقق
    const sub = await this.subscriptionService.findSub(userId);

    if (!sub) {
      throw new NotFoundException('')
    }

    return this.themeRepo.find({
      where: { themePlans : {plan : {id : sub.planId}} },
    });
  }

  async activeThemePlan(userId: string, data: { storeId: string; themeId: string }) {
    const { themeId, storeId } = data;

    // ✅ findSub يعالج انتهاء الصلاحية أولاً — لا يمكن استخدام صف اشتراك منتهٍ
    // لم تتم معالجته بعد لتفعيل ثيم لم يعد ضمن الخطة الفعلية للمستخدم
    const sub = await this.subscriptionService.findSub(userId);
    const themePlan = sub?.planId
      ? await this.themePlanRepo.findOne({ where: { planId: sub.planId, themeId } })
      : null;

    if (!themePlan) {
      throw new NotFoundException('هذا القالب غير مدرج في خطتك النشطة');
    }

    // التحديث
    await this.storeRepo.update(storeId, { themeId: themeId });

    return { message: 'تم تفعيل القالب بنجاح' };
}

  // ─────────────────────────────────────────────
  //  installTheme
  // ─────────────────────────────────────────────
  async installTheme(themeId: string, userId: string, couponCode?: string) {
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

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // السعر يُدفع دائماً حسب سعر الثيم الحقيقي، حتى لو كان مضمّناً في خطة
      // المستخدم — "مضمّن في الخطة" مجرد شارة إعلامية هنا، لا يُسقط السعر.
      const basePrice = Number(theme.price || 0);

      const newThemeUser = this.themeUserRepo.create({ userId, themeId });
      await queryRunner.manager.save(newThemeUser);

      let price = basePrice;
      if (couponCode && basePrice > 0) {
        const result = await this.couponService.redeemCoupon(
          couponCode, userId, 'theme', basePrice,
          CouponContext.THEME_PURCHASE, newThemeUser.id, queryRunner.manager,
        );
        price = result.finalPrice;
      }

      if (price > 0) {
        await this.paymentService.handleWalletBalance(
          userId,
          price,
          'SUB',
          TransactionType.SELL_THEME,
          queryRunner.manager,
        );
      }

      await queryRunner.commitTransaction();
      return this.res(true, 'Theme installed successfully');

    } catch (error:any) {
      await queryRunner.rollbackTransaction();
      return this.res(false, error.message || 'Installation failed');
    } finally {
      await queryRunner.release();
    }
  }

  async activeTheme(userId, { themeId, storeId, isDefault }) {

    if (isDefault === true || !themeId) {
      console.log(!themeId);
      
      await this.storeRepo.update(storeId, { themeId: null });
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