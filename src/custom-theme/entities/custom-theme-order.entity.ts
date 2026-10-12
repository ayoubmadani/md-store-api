import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Theme } from '../../theme/entities/theme.entity';
import { Store } from '../../store/entities/store.entity';
import { CustomThemeJob } from './custom-theme-job.entity';

// ثيم خاص اشتراه تاجر لمتجره: تصنعه المنصة بـ Claude، وله عدد مراجعات (طلبات تعديل)
@Entity('custom_theme_orders')
export class CustomThemeOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  storeId: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'storeId' })
  store: Store;

  // سجل الثيم (نوع custom، يملكه التاجر) — null حتى يجهز أول إصدار
  @Column({ type: 'uuid', nullable: true })
  themeId: string | null;

  @ManyToOne(() => Theme, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'themeId' })
  theme: Theme | null;

  @Column({ type: 'varchar', length: 120 })
  slug: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  pricePaid: number;

  @Column({ default: 0 })
  revisionsTotal: number;

  @Column({ default: 0 })
  revisionsUsed: number;

  // كود الإصدار المنشور حالياً (أساس طلب التعديل التالي)
  @Column({ type: 'text', nullable: true })
  liveCode: string | null;

  @OneToMany(() => CustomThemeJob, (j) => j.order)
  jobs: CustomThemeJob[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
