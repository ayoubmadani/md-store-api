import { User } from "../../user/entities/user.entity";
import { Column, Entity, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { Plan } from "./plan.entity";


@Entity('subscriptions')
export class Subscription {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    // ربط الاشتراك بالمستخدم (علاقة كثير إلى واحد)
    @ManyToOne(() => User, (user) => user.subscriptions)
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column()
    userId: string;

    // ربط الاشتراك بالخطة
    @ManyToOne(() => Plan)
    @JoinColumn({ name: 'planId' })
    plan: Plan;

    @Column()
    planId: string;

    @Column({
        type: 'enum',
        enum: ['active', 'canceled', 'expired', 'past_due', 'trailing_period'],
        default: 'active'
    })
    status: 'active' | 'canceled' | 'expired' | 'past_due' | 'trailing_period';

    // معرف الاشتراك في Stripe (مهم جداً لإدارة الإلغاء والتجديد)
    @Column({ nullable: true })
    stripeSubscriptionId?: string;

    @Column({ type: 'timestamp' })
    startDate: Date;

    @Column({ type: 'timestamp' })
    endDate: Date;

    @Column({ default: false })
    cancelAtPeriodEnd: boolean; // هل سيتم الإلغاء في نهاية الدورة الحالية؟

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}