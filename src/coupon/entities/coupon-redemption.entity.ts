import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn,
} from 'typeorm';
import { Coupon } from './coupon.entity';
import { User } from '../../user/entities/user.entity';

export enum CouponContext {
  PLAN_SUBSCRIPTION = 'plan_subscription',
  PLAN_UPGRADE = 'plan_upgrade',
  THEME_PURCHASE = 'theme_purchase',
}

@Entity('coupon_redemptions')
export class CouponRedemption {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  couponId: string;

  @ManyToOne(() => Coupon)
  @JoinColumn({ name: 'couponId' })
  coupon: Coupon;

  @Column()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'enum', enum: CouponContext })
  context: CouponContext;

  @Column({ type: 'varchar', nullable: true })
  contextId: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  basePrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  discountAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  finalPrice: number;

  @CreateDateColumn()
  createdAt: Date;
}
