import { User } from '../../user/entities/user.entity';
import { Theme } from '../../theme/entities/theme.entity';
import { Plan } from '../../subscription/entities/plan.entity';
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, JoinColumn } from 'typeorm';

export enum TransactionAction {
    PAYMENT = 'payment',
    DESPOSIT = 'deposit'
}

export enum TransactionType {
    PLAN_SUBSCRIPTION = 'plan_subscription', // دفع ثمن الخطة
    PLAN_UPGRADE = 'plan_upgrade',           // ترقية الخطة
    STORE_FEE = 'store_fee',                 // رسوم المتجر
    REFUND = 'refund',                        // استرجاع
    SELL_THEME = "sell_theme",
    TOP_UP = 'top_up',
}

@Entity('transactions')
export class Transaction {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'enum', enum: TransactionAction })
    action: TransactionAction;

    @Column({ type: 'enum', enum: TransactionType })
    type: TransactionType;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    amount: number;

    @Column({ nullable: true })
    typeId: number; 

    @Column()
    userId: string;

    // --- الحقل الجديد المضاف ---
    @Column({ nullable: true, unique: true }) 
    providerTransactionId: string; // لتخزين معرف عملية Chargily ومنع التكرار
    // ---------------------------

    @ManyToOne(() => User, (user) => user.transactions)
    @JoinColumn({ name: "userId" })
    user: User;

    // --- مرجع الغرض المشترى (لمعرفة أي ثيم/خطة بالضبط) ---
    @Column({ type: 'uuid', nullable: true })
    themeId: string | null;

    @ManyToOne(() => Theme, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'themeId' })
    theme: Theme;

    @Column({ type: 'uuid', nullable: true })
    planId: string | null;

    @ManyToOne(() => Plan, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'planId' })
    plan: Plan;
    // ---------------------------

    @CreateDateColumn()
    createdAt: Date;
}