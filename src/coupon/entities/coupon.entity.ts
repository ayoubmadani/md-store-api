import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';

export enum CouponDiscountType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
}

export enum CouponScope {
  PLAN = 'plan',
  THEME = 'theme',
  BOTH = 'both',
}

@Entity('coupons')
export class Coupon {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50, unique: true })
  code: string;

  @Column({ length: 255, nullable: true })
  description?: string;

  @Column({ type: 'enum', enum: CouponDiscountType })
  discountType: CouponDiscountType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  discountValue: number;

  @Column({ type: 'enum', enum: CouponScope, default: CouponScope.BOTH })
  scope: CouponScope;

  // ── Plan-purchase limits (used when scope is 'plan' or 'both') ───────────
  @Column({ type: 'int', nullable: true })
  maxUsesPlan: number | null;

  @Column({ type: 'int', default: 0 })
  usedCountPlan: number;

  @Column({ type: 'int', nullable: true })
  maxUsesPerUserPlan: number | null;

  // ── Theme-purchase limits (used when scope is 'theme' or 'both') ─────────
  @Column({ type: 'int', nullable: true })
  maxUsesTheme: number | null;

  @Column({ type: 'int', default: 0 })
  usedCountTheme: number;

  @Column({ type: 'int', nullable: true })
  maxUsesPerUserTheme: number | null;

  @Column({ type: 'timestamp', nullable: true })
  startsAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
