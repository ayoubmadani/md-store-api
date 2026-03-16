import { User } from "../../user/entities/user.entity";
import { Column, Entity, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { Plan } from "./plan.entity";

@Entity('subscriptions')
export class Subscription {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => User, (user) => user.subscriptions)
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column()
    userId: string;

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

    // ← إضافة interval لمعرفة هل الاشتراك شهري أو سنوي
    @Column({
        type: 'enum',
        enum: ['month', 'year'],
        default: 'month'
    })
    interval: 'month' | 'year';

    @Column({ nullable: true })
    stripeSubscriptionId?: string;

    @Column({ type: 'timestamp' })
    startDate: Date;

    @Column({ type: 'timestamp' })
    endDate: Date;

    @Column({ default: false })
    cancelAtPeriodEnd: boolean;

    @Column({ default: true })
    autoRenew: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}