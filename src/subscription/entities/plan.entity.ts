import { Column, Entity, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity('plans') // تحديد اسم الجدول في قاعدة البيانات
export class Plan {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ length: 100 })
    name: string; // مثال: "Pro Plan"

    // استخدام decimal لضمان دقة الحسابات المالية
    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    price: number;

    @Column({ default: 'DZD' })
    currency: string;

    // تعريف الـ Enum بشكل أوضح داخل قاعدة البيانات
    @Column({
        type: 'enum',
        enum: ['month', 'year'],
        default: 'month'
    })
    interval: 'month' | 'year';

    // ملاحظة: PostgreSQL يدعم simple-array أو json
    @Column({ type: 'simple-array', nullable: true })
    features: string[];

    @Column({ nullable: true })
    stripePriceId?: string;

    @Column({ default: true })
    isActive: boolean;

    // إضافة طوابع زمنية مفيدة للتدقيق
    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}   