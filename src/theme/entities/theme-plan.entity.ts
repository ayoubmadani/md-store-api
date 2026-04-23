import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Theme } from "./theme.entity";
import { Plan } from "../../subscription/entities/plan.entity";

@Entity()
export class ThemePlan {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    themeId: string;

    // إضافة onDelete: 'CASCADE' تعني إذا حُذف الثيم، يتم حذف الارتباط هنا تلقائياً
    @ManyToOne(() => Theme, (theme) => theme.themePlans, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'themeId' })
    theme: Theme; 

    @Column()
    planId: string;

    // إضافة onDelete: 'CASCADE' تعني إذا حُذفت الخطة، يتم حذف الارتباط هنا تلقائياً
    @ManyToOne(() => Plan, (plan) => plan.themePlans, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'planId' })
    plan: Plan;
}