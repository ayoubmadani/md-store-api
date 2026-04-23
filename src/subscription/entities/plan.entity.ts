import { Column, Entity, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToOne, JoinColumn, OneToMany } from "typeorm";
import { FeaturesEntity } from "./features.entity";
import { ThemePlan } from "../../theme/entities/theme-plan.entity";

@Entity('plans')
export class Plan {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ length: 100 })
    name: string;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    monthlyPrice: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    yearlyPrice: number;

    @Column({ default: 'DZD' })
    currency: string;

    @OneToOne(() => FeaturesEntity, { cascade: true })
    @JoinColumn()
    features: FeaturesEntity;

    @Column({ nullable: true })
    stripePriceId?: string;

    @Column({ default: true })
    isActive: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    // ✅ التصحيح: بما أنها OneToMany، يجب أن تكون مصفوفة []ThemePlan
    // ✅ وأيضاً نربطها بالحقل 'plan' الموجود في ملف ThemePlan
    @OneToMany(() => ThemePlan, (themePlan) => themePlan.plan)
    themePlans: ThemePlan[];
}