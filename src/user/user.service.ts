import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dto/create-user.dto';
import { User, AuthProvider } from './entities/user.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';
import { ResetNewPassword } from './dto/reset-new-password.dto';
import { SubscriptionService } from '../subscription/subscription.service';
import { Store } from '../store/entities/store.entity';
import { Product } from '../product/entities/product.entity';
import { Subscription } from '../subscription/entities/subscription.entity';
import { StorePixel } from '../store/entities/store-pixel.entity';
import { LandingPage } from '../landing-page/entities/landing-page.entity';
import { MessageUser } from './entities/message-user.entity';
import { Theme } from '../theme/entities/theme.entity';
import { ThemeUser } from '../theme/entities/theme-user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Store) private readonly storeRepo: Repository<Store>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(Subscription) private readonly subRepo: Repository<Subscription>,
    @InjectRepository(StorePixel) private readonly pixelRepo: Repository<StorePixel>,
    @InjectRepository(LandingPage) private readonly lpRepo: Repository<LandingPage>,
    @InjectRepository(MessageUser) private readonly msgRepo: Repository<MessageUser>,
    @InjectRepository(Theme) private readonly themeRepo: Repository<Theme>,
    @InjectRepository(ThemeUser) private readonly themeUserRepo: Repository<ThemeUser>,

    private readonly config: ConfigService,
    private readonly mailService: MailService,
    private readonly subscriptionService: SubscriptionService,
  ) { }

  async create(dto: CreateUserDto): Promise<User> {
    const existingUser = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existingUser) {
      throw new BadRequestException('User already exists');
    }

    if (!dto.provider) {
      dto.provider = AuthProvider.CREDENTIALS;
    }

    // 1. تحديد حالة التفعيل تلقائياً
    // إذا كان القادم من جوجل، نعتبره مفعلاً مسبقاً
    let isVerified = false;
    if (dto.provider === AuthProvider.GOOGLE) {
      isVerified = true;
    }

    if (dto.provider === AuthProvider.CREDENTIALS && !dto.password) {
      throw new BadRequestException('Password is required for CREDENTIALS provider');
    }

    let hashedPassword: string | undefined;
    if (dto.password) {
      hashedPassword = await bcrypt.hash(dto.password, 10);
    }

    let otp: number | null = null;
    let otpExpires: Date | null = null;

    // 2. إرسال OTP فقط للمستخدمين العاديين (Credentials)
    if (dto.provider === AuthProvider.CREDENTIALS) {
      otp = Math.floor(10000 + Math.random() * 90000);
      otpExpires = new Date();
      otpExpires.setMinutes(otpExpires.getMinutes() + 10);

      await this.mailService.sendOTP(dto.email, otp);
    }

    const random = Math.floor(100 + Math.random() * 900);
    const cleanUsername = dto.username.trim().replace(/\s+/g, '-').toLowerCase();
    const topic = `${cleanUsername}-${random}`;

    const user = this.userRepo.create({
      username: dto.username,
      email: dto.email,
      phone: dto.phone,
      provider: dto.provider,
      isVerified: isVerified, // القيمة المعدلة هنا
      password: hashedPassword,
      image: dto.image ?? this.config.get<string>('DEFAULT_AVATAR'),
      otp: otp,
      topic: topic,
      otpExpires: otpExpires
    } as User);

    await this.userRepo.save(user);

    return {
      success: true
    } as any
  }

  async findUserByEmail(email: string) {
    const user = await this.userRepo.findOne({ where: { email } })

    if (!user) {
      throw new BadRequestException('user not found')
    }

    return user
  }

  // أضف هذه في user.service.ts
  async findOneByEmail(email: string): Promise<User | null> {
    return await this.userRepo.findOne({ where: { email } });
  }

  async findUserById(id: string) {
    const user = await this.userRepo.findOne({ where: { id } })

    if (!user) {
      throw new NotFoundException('user not found')
    }

    return {
      username: user.username,
      email: user.email,
      phone: user.phone,
      image: user.image,
      provider: user.provider,
      isVerified: user.isVerified,
      topic: user.topic,
      isNtfy: user.isNtfy
    }
  }

  async resetNewPassword(id: string, dto: ResetNewPassword) {
    const user = await this.userRepo.findOne({ where: { id } });

    if (!user) {
      throw new NotFoundException('User Not Found');
    }

    // الحالة الأولى: مستخدم Google "نقي" (أول مرة يضع كلمة مرور)
    if (user.provider === AuthProvider.GOOGLE) {
      await this.updateUser({
        password: dto.newPassword,
        provider: AuthProvider.CREDENTIALS_GOOGLE // تحويل الحالة لتعكس وجود كلمة مرور
      } as any, id);

      return { message: 'Password set successfully. You can now login with email or Google.' };
    }

    // الحالة الثانية: مستخدم لديه كلمة مرور مسبقاً (سواء سجل عادي أو هجين)
    const hasPasswordProvider = [AuthProvider.CREDENTIALS, AuthProvider.CREDENTIALS_GOOGLE].includes(user.provider);

    if (hasPasswordProvider) {
      // التحقق من وجود كلمة المرور الحالية في الطلب وفي قاعدة البيانات
      if (!dto.password || !user.password) {
        throw new BadRequestException('Current password is required to change it');
      }

      const isMatch = await bcrypt.compare(dto.password, user.password);

      if (!isMatch) {
        throw new BadRequestException('Current password is incorrect');
      }

      await this.updateUser({
        password: dto.newPassword
      } as any, id);

      return { message: 'Password updated successfully' };
    }

    throw new BadRequestException('Action not allowed for this account provider');
  }

  private async getIsNotfy(userId: string) {
    const sub = await this.subscriptionService.findSub(userId);
    if (sub?.plan?.features?.isNtfy === false) {
      throw new BadRequestException('خطة اشتراكك الحالية لا تدعم ميزة التنبيهات.');
    }
  }

  async toggleNtfy(userId) {
    let user = await this.userRepo.findOne({ where: { id: userId } })
    await this.getIsNotfy(userId);
    const apdateUser = await this.userRepo.update(userId, {
      isNtfy: !user?.isNtfy
    });
    return !user?.isNtfy
  }

  async updateUser(dto: UpdateUserDto, id: string) {
    // إذا كان هناك كلمة مرور، قم بتشفيرها
    if (dto.password) {
      dto.password = await bcrypt.hash(dto.password, 10);
    }


    if (dto.isNtfy === true) {
      await this.getIsNotfy(id);
    }

    // بدلاً من find ثم assign ثم save
    // استخدم update مباشرة فهي أسرع ولا تحاول عمل Insert أبداً
    await this.userRepo.update(id, dto);

    return this.findUserById(id); // إرجاع المستخدم المحدث
  }

  async initSub(userId: string) {
    // 1. جلب بيانات الاشتراك الفعال مع كافة علاقات الثيمات المرتبطة بالخطة
    const sub = await this.subRepo.findOne({
      where: { userId, status: 'active' },
      relations: ['plan', 'plan.features', 'plan.themePlans', 'plan.themePlans.theme'],
      order: { startDate: 'DESC' },
    });

    // إذا لم يوجد اشتراك فعال، يفضل تصفير الميزات أو الخروج (حسب منطق عملك)
    if (!sub || !sub.plan.features) return;
    const f = sub.plan.features;

    // 2. حساب الأعداد الحالية للموارد (المتاجر، المنتجات، البيكسل، صفحات الهبوط)
    const [storeCount, productCount, pixelfbCount, pixeltikCount, lpCount] = await Promise.all([
      this.storeRepo.count({ where: { isActive: true, user: { id: userId } } }),
      this.productRepo.count({ where: { isActive: true, store: { user: { id: userId } } } }),
      this.pixelRepo.count({ where: { isActive: true, type: 'facebook', store: { user: { id: userId } } } }),
      this.pixelRepo.count({ where: { isActive: true, type: 'tiktok', store: { user: { id: userId } } } }),
      this.lpRepo.count({ where: { isActive: true, product: { store: { user: { id: userId } } } } }),
    ]);

    // 3. تعطيل الموارد الزائدة عن حدود الخطة (Enforcement Logic)

    // المتاجر الزائدة
    if (storeCount > f.storeNumber) {
      await this.storeRepo.createQueryBuilder()
        .update()
        .set({ isActive: false })
        .where('"userId" = :userId', { userId })
        .execute();
    }

    // المنتجات الزائدة
    if (productCount > f.productNumber) {
      await this.productRepo.createQueryBuilder()
        .update()
        .set({ isActive: false })
        .where('"storeId" IN (SELECT id FROM stores WHERE "userId" = :userId)', { userId })
        .execute();
    }

    // بيكسل فيسبوك الزائد
    if (pixelfbCount > f.pixelFacebookNumber) {
      await this.pixelRepo.createQueryBuilder()
        .update()
        .set({ isActive: false })
        .where('type = :type', { type: 'facebook' })
        .andWhere('"storeId" IN (SELECT id FROM stores WHERE "userId" = :userId)', { userId })
        .execute();
    }

    // بيكسل تيك توك الزائد
    if (pixeltikCount > f.pixelTiktokNumber) {
      await this.pixelRepo.createQueryBuilder()
        .update()
        .set({ isActive: false })
        .where('type = :type', { type: 'tiktok' })
        .andWhere('"storeId" IN (SELECT id FROM stores WHERE "userId" = :userId)', { userId })
        .execute();
    }

    // صفحات الهبوط الزائدة
    if (lpCount > f.landingPageNumber) {
      await this.lpRepo.createQueryBuilder()
        .update()
        .set({ isActive: false })
        .where('"productId" IN (SELECT p.id FROM products p INNER JOIN stores s ON p."storeId" = s.id WHERE s."userId" = :userId)', { userId })
        .execute();
    }

    // 4. التحقق من صلاحية الثيمات (Theme Access Enforcement)
    const themePlanIds = sub.plan.themePlans.map(item => item.themeId);
    const themeUser = await this.themeUserRepo.find({ where: { userId } });
    const themeUserIds = themeUser.map(item => item.themeId);

    const stores = await this.storeRepo.find({ where: { user: { id: userId } } });

    console.log({themePlanIds ,themeUserIds , stores });
    

    const updatePromises:any = [];

    for (const store of stores) {
      // إذا كان للمتجر ثيم، وهذا الثيم غير موجود في الخطة ولا في الثيمات المشتراة من المستخدم
      if (store.themeId && !themePlanIds.includes(store.themeId) && !themeUserIds.includes(store.themeId)) {
        console.log(`🚫 Removing unauthorized theme ${store.themeId} from store ${store.name}`);

        updatePromises.push(
          this.storeRepo.update(store.id, { themeId: null as any })
        );
      }
    }

    // تنفيذ جميع عمليات تصفير الثيمات غير المصرح بها
    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
    }

    console.log(`✅ Subscription initialization completed for user: ${userId}`);
  }

  async createMessage(dto: any) {
    const user = await this.userRepo.findOne({ where: { stores: { id: dto.storeId } } })

    if (!user) {
      throw new NotFoundException('user not found')
    }

    const msg = this.msgRepo.create({
      userId: user.id,
      storeId: dto.storeId,
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      message: dto.message
    })

    await this.msgRepo.save(msg)

    return { success: true }
  }

  async getMessages(
    userId: string,
    nb: string = "1",
    dto: { filter?: string, archive?: string, viewed?: string }
  ) {
    const isArchived = dto.archive === 'true';
    const search = dto.filter;

    // 1. بناء المعايير الأساسية (Base Criteria)
    const baseCriteria: any = {
      userId,
      isArchived,
    };

    // 2. معالجة حالة المقروء/غير المقروء
    // إذا أرسلنا viewed=true نجلب المقروء فقط
    // إذا أرسلنا viewed=false نجلب غير المقروء فقط
    // إذا لم نرسل البارامتر (undefined) نجلب الكل (وهذا يفيد تبويب "الكل")
    if (dto.viewed !== undefined) {
      baseCriteria.isViewed = dto.viewed === 'true';
    }

    // 3. بناء الاستعلام مع دعم البحث
    return this.msgRepo.find({
      where: search
        ? [
          { ...baseCriteria, email: ILike(`%${search}%`) },
          { ...baseCriteria, phone: ILike(`%${search}%`) },
          { ...baseCriteria, name: ILike(`%${search}%`) }
        ]
        : baseCriteria,
      relations: ['store', 'store.design'],
      order: { createdAt: 'DESC' },
      skip: (+nb - 1) * 50,
      take: 50
    });
  }

  // تحديث حالة المشاهدة (Vue)
  async markAsViewed(id: string) {
    return this.msgRepo.update(id, { isViewed: true });
  }

  // تحديث حالة الأرشفة (Archive)
  async toggleArchive(id: string, state: boolean = true) {
    // جعلتها toggle لتمكين المستخدم من إلغاء الأرشفة أيضاً
    return this.msgRepo.update(id, { isArchived: state });
  }

  // حذف الرسالة نهائياً
  async deleteMessage(id: string) {
    return this.msgRepo.delete(id);
  }

}
/*
 * flaturer categories يظهر الاسم فقط
 * nav bar الرئيسية تواصل الخصوصية logo
 * footer 3 sction logo name store slug , روابط  سياسة الخصوصية شروط الخدمة ملفات الارتباط اتصل بنا, 
 */

