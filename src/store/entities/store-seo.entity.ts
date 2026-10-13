import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Store } from './store.entity';

// إعدادات SEO لكل متجر (صف واحد لكل متجر) — يقرؤها المتجر في generateMetadata
@Entity({ name: 'store_seo' })
export class StoreSeo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', unique: true })
  storeId: string;

  @OneToOne(() => Store, (store) => store.seo, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'storeId' })
  store: Store;

  // عنوان الصفحة في نتائج Google (فارغ = اسم المتجر)
  @Column({ type: 'varchar', length: 70, nullable: true })
  metaTitle: string | null;

  @Column({ type: 'varchar', length: 170, nullable: true })
  metaDescription: string | null;

  // كلمات مفتاحية مفصولة بفواصل
  @Column({ type: 'varchar', length: 300, nullable: true })
  keywords: string | null;

  // صورة المشاركة في فيسبوك/واتساب (1200×630)
  @Column({ type: 'varchar', length: 500, nullable: true })
  ogImageUrl: string | null;

  // محتوى وسم التحقق فقط (google-site-verification / msvalidate.01)
  @Column({ type: 'varchar', length: 120, nullable: true })
  googleVerification: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  bingVerification: string | null;

  // false = noindex (متجر قيد التجهيز مثلاً)
  @Column({ default: true })
  allowIndexing: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
