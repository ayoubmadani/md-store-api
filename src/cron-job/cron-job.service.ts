import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Subscription } from '../subscription/entities/subscription.entity';
import { Store } from '../store/entities/store.entity';
import { Product } from '../product/entities/product.entity';

@Injectable()
export class CronJobService {
  private readonly logger = new Logger(CronJobService.name);

  constructor(
    @InjectRepository(Subscription)
    private subRepo: Repository<Subscription>,
    @InjectRepository(Store)
    private storeRepo: Repository<Store>,
    @InjectRepository(Product)
    private productRepo: Repository<Product>,
  ) { }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async syncSubscriptionsAndLimits() {
    this.logger.log('جاري فحص الاشتراكات وتحديث القيود...');
    const now = new Date();

    const expiredSubs = await this.subRepo.find({
      where: {
        status: 'active',
        endDate: LessThan(now),
      },
    });

    if (expiredSubs.length === 0) {
      this.logger.log('لا توجد اشتراكات منتهية لمعالجتها.');
      return;
    }

    for (const sub of expiredSubs) {
      try {
        sub.status = 'expired';
        await this.subRepo.save(sub);

        // استخدام userId مباشرة من حقل الـ Column (أسرع) أو من العلاقة
        await this.applyFreeLimits(sub.userId);

        this.logger.log(`تم إنهاء اشتراك وتطبيق قيود المجاني للمستخدم: ${sub.userId}`);
      } catch (error) {
        this.logger.error(`فشل معالجة اشتراك المستخدم ${sub.userId}:`, error.stack);
      }
    }
  }

  private async applyFreeLimits(userId: string) {
    // 1. جلب المتاجر النشطة (نحتاج لجلبهم أولاً لنعرف من هو الأقدم الذي سيبقى)
    const stores = await this.storeRepo.find({
      where: { user: { id: userId }, isActive: true },
      order: { createdAt: 'ASC' },
    });

    if (stores.length > 1) {
      const excessStoreIds = stores.slice(1).map(s => s.id);

      // Batch Update للمتاجر: تعطيل الكل بضربة واحدة
      await this.storeRepo
        .createQueryBuilder()
        .update(Store)
        .set({ isActive: false })
        .whereInIds(excessStoreIds)
        .execute();

      this.logger.log(`تم تعطيل ${excessStoreIds.length} متاجر للمستخدم ${userId}`);
    }

    // 2. إدارة المنتجات في المتجر الأول
    if (stores.length > 0) {
      const activeStoreId = stores[0].id;

      // جلب معرفات المنتجات التي تزيد عن الحد (4)
      const excessProducts = await this.productRepo.find({
        select: ['id'], // نطلب الـ id فقط لتقليل استهلاك الذاكرة
        where: { store: { id: activeStoreId }, isActive: true },
        order: { createdAt: 'ASC' },
        skip: 4, // تخطي أول 4 منتجات (الأقدم)
      });

      if (excessProducts.length > 0) {
        const excessProductIds = excessProducts.map(p => p.id);

        // Batch Update للمنتجات: تعطيل الكل بضربة واحدة
        await this.productRepo
          .createQueryBuilder()
          .update(Product)
          .set({ isActive: false })
          .whereInIds(excessProductIds)
          .execute();

        this.logger.log(`تم تعطيل ${excessProductIds.length} منتجات في المتجر ${activeStoreId}`);
      }
    }
  }
}