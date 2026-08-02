import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { Coupon, CouponDiscountType, CouponScope } from './entities/coupon.entity';
import { CouponRedemption, CouponContext } from './entities/coupon-redemption.entity';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

type PurchaseType = 'plan' | 'theme';

@Injectable()
export class CouponService {
  constructor(
    @InjectRepository(Coupon) private readonly couponRepo: Repository<Coupon>,
    @InjectRepository(CouponRedemption) private readonly redemptionRepo: Repository<CouponRedemption>,
  ) {}

  private normalizeCode(code: string): string {
    return code.trim().toUpperCase();
  }

  private computeDiscount(coupon: Coupon, basePrice: number): number {
    if (basePrice <= 0) return 0;
    const raw = coupon.discountType === CouponDiscountType.PERCENTAGE
      ? basePrice * (Number(coupon.discountValue) / 100)
      : Number(coupon.discountValue);
    return Math.min(Math.max(raw, 0), basePrice);
  }

  // كل نوع شراء (plan/theme) له عدّاد استخدام إجمالي وعدّاد لكل مستخدم مستقلّان تماماً
  private getTypeLimits(coupon: Coupon, type: PurchaseType) {
    return type === 'plan'
      ? { maxUses: coupon.maxUsesPlan, usedCount: coupon.usedCountPlan, maxUsesPerUser: coupon.maxUsesPerUserPlan }
      : { maxUses: coupon.maxUsesTheme, usedCount: coupon.usedCountTheme, maxUsesPerUser: coupon.maxUsesPerUserTheme };
  }

  private assertUsable(coupon: Coupon | null, type: PurchaseType): asserts coupon is Coupon {
    if (!coupon) throw new BadRequestException('كود الخصم غير صالح');
    if (!coupon.isActive) throw new BadRequestException('كود الخصم غير مفعّل');

    const now = new Date();
    if (coupon.startsAt && now < new Date(coupon.startsAt)) throw new BadRequestException('كود الخصم غير متاح بعد');
    if (coupon.expiresAt && now > new Date(coupon.expiresAt)) throw new BadRequestException('انتهت صلاحية كود الخصم');

    if (coupon.scope !== CouponScope.BOTH && coupon.scope !== type) {
      throw new BadRequestException('كود الخصم غير صالح لهذا النوع من المنتجات');
    }

    const { maxUses, usedCount } = this.getTypeLimits(coupon, type);
    if (maxUses !== null && usedCount >= maxUses) {
      throw new BadRequestException('تم استنفاد عدد مرات استخدام هذا الكود');
    }
  }

  // ─── Preview (read-only, no redemption) ────────────────────────────────────
  async previewCoupon(code: string, userId: string, scope: PurchaseType, basePrice?: number) {
    const normalized = this.normalizeCode(code);
    const coupon = await this.couponRepo.findOne({ where: { code: normalized } });
    this.assertUsable(coupon, scope);

    const { maxUsesPerUser } = this.getTypeLimits(coupon, scope);
    if (maxUsesPerUser !== null) {
      const userUsage = await this.redemptionRepo.count({
        where: { couponId: coupon.id, userId, context: In(this.contextsFor(scope)) },
      });
      if (userUsage >= maxUsesPerUser) {
        throw new BadRequestException('لقد استخدمت هذا الكود من قبل الحد المسموح');
      }
    }

    const result: {
      valid: boolean;
      discountType: CouponDiscountType;
      discountValue: number;
      discountAmount?: number;
      finalPrice?: number;
    } = {
      valid: true,
      discountType: coupon.discountType,
      discountValue: Number(coupon.discountValue),
    };

    if (basePrice !== undefined) {
      const discountAmount = this.computeDiscount(coupon, basePrice);
      result.discountAmount = discountAmount;
      result.finalPrice = Number((basePrice - discountAmount).toFixed(2));
    }

    return result;
  }

  private contextsFor(type: PurchaseType): CouponContext[] {
    return type === 'plan'
      ? [CouponContext.PLAN_SUBSCRIPTION, CouponContext.PLAN_UPGRADE]
      : [CouponContext.THEME_PURCHASE];
  }

  // ─── Redeem — atomic, must be called inside the caller's own transaction ──
  async redeemCoupon(
    code: string,
    userId: string,
    scope: PurchaseType,
    basePrice: number,
    context: CouponContext,
    contextId: string | null,
    manager: EntityManager,
  ): Promise<{ finalPrice: number; discountAmount: number; couponId: string }> {
    const normalized = this.normalizeCode(code);
    const coupon = await manager.findOne(Coupon, {
      where: { code: normalized },
      lock: { mode: 'pessimistic_write' },
    });

    this.assertUsable(coupon, scope);

    const { maxUsesPerUser } = this.getTypeLimits(coupon, scope);
    if (maxUsesPerUser !== null) {
      const userUsage = await manager.count(CouponRedemption, {
        where: { couponId: coupon.id, userId, context: In(this.contextsFor(scope)) },
      });
      if (userUsage >= maxUsesPerUser) {
        throw new BadRequestException('لقد استخدمت هذا الكود من قبل الحد المسموح');
      }
    }

    const discountAmount = this.computeDiscount(coupon, basePrice);
    const finalPrice = Math.max(0, Number((basePrice - discountAmount).toFixed(2)));

    if (scope === 'plan') coupon.usedCountPlan += 1;
    else coupon.usedCountTheme += 1;

    await manager.save(coupon);
    await manager.save(manager.create(CouponRedemption, {
      couponId: coupon.id,
      userId,
      context,
      contextId,
      basePrice,
      discountAmount,
      finalPrice,
    }));

    return { finalPrice, discountAmount, couponId: coupon.id };
  }

  // ─── Admin CRUD ─────────────────────────────────────────────────────────────
  async create(dto: CreateCouponDto): Promise<Coupon> {
    const code = this.normalizeCode(dto.code);
    const existing = await this.couponRepo.findOne({ where: { code } });
    if (existing) throw new ConflictException(`كود الخصم "${code}" موجود بالفعل`);

    const coupon = this.couponRepo.create({
      ...dto,
      code,
      maxUsesPlan: dto.maxUsesPlan ?? null,
      maxUsesPerUserPlan: dto.maxUsesPerUserPlan ?? null,
      maxUsesTheme: dto.maxUsesTheme ?? null,
      maxUsesPerUserTheme: dto.maxUsesPerUserTheme ?? null,
      startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
    });
    return this.couponRepo.save(coupon);
  }

  async findAll(filters: { active?: boolean; scope?: string } = {}): Promise<Coupon[]> {
    const where: Partial<Record<'isActive' | 'scope', any>> = {};
    if (filters.active !== undefined) where.isActive = filters.active;
    if (filters.scope) where.scope = filters.scope;
    return this.couponRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<Coupon> {
    const coupon = await this.couponRepo.findOne({ where: { id } });
    if (!coupon) throw new NotFoundException(`كود الخصم بالمعرف "${id}" غير موجود`);
    return coupon;
  }

  async update(id: string, dto: UpdateCouponDto): Promise<Coupon> {
    const coupon = await this.findOne(id);

    if (dto.code) {
      const normalized = this.normalizeCode(dto.code);
      if (normalized !== coupon.code) {
        const existing = await this.couponRepo.findOne({ where: { code: normalized } });
        if (existing) throw new ConflictException(`كود الخصم "${normalized}" موجود بالفعل`);
        coupon.code = normalized;
      }
    }

    const { code, startsAt, expiresAt, ...rest } = dto;
    this.couponRepo.merge(coupon, rest);
    if (startsAt !== undefined) coupon.startsAt = startsAt ? new Date(startsAt) : null;
    if (expiresAt !== undefined) coupon.expiresAt = expiresAt ? new Date(expiresAt) : null;

    return this.couponRepo.save(coupon);
  }

  async toggleStatus(id: string): Promise<Coupon> {
    const coupon = await this.findOne(id);
    coupon.isActive = !coupon.isActive;
    return this.couponRepo.save(coupon);
  }

  async remove(id: string): Promise<void> {
    const coupon = await this.findOne(id);
    const totalUsed = coupon.usedCountPlan + coupon.usedCountTheme;
    if (totalUsed > 0) {
      throw new ConflictException(`لا يمكن حذف هذا الكود — تم استخدامه ${totalUsed} مرة`);
    }
    await this.couponRepo.delete(id);
  }
}
