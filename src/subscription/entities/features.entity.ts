import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity('plan_features')
export class FeaturesEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'int', default: 0 })
    storeNumber: number; // تصحيح إملائي: Number بدلاً من Numbre

    @Column({ type: 'int', default: 0 })
    productNumber: number;

    @Column({ type: 'int', default: 1 })
    productImagesNumber: number;

    @Column({ type: 'int', default: 4 })
    totalImagesNumber: number;

    @Column({ type: 'int', default: 0 })
    landingPageNumber: number;

    // عدد الدومينات لكل متجر (فرعية mdstore.top + خاصة، للمتجر ولصفحات الهبوط معاً)
    @Column({ type: 'int', default: 3 })
    domainNumber: number;

    // استخدام boolean أفضل للإشعارات (أو int إذا كنت تفضل 0/1)
    @Column({ type: 'boolean', default: false })
    isNtfy: boolean;

    // عدد أعضاء الفريق (مستخدمون مختلفون عبر كل متاجر المالك، مقبولون أو مدعوون) — 0 = المشاركة غير متاحة
    @Column({ type: 'int', default: 0 })
    maxMembers: number;

    @Column({ type: 'int', default: 0 })
    pixelTiktokNumber: number; // تصحيح إملائي: Pixel

    @Column({ type: 'int', default: 0 })
    pixelFacebookNumber: number;

    // العمولات يفضل أن تكون decimal لدقة الحسابات
    @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
    commission: number;

    // في TypeORM نستخدم type: 'json' أو 'jsonb' (لـ Postgres)
    @Column({ type: 'json', nullable: true })
    theme: any; 
}