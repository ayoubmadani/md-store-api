import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Store } from '../../store/entities/store.entity';

export interface SplitVariant {
  builderPageId: string;
  // نسبة من الزوار (الأوزان تُطبَّع: 1/1/1 = ثلث لكل صفحة)
  weight: number;
}

// اختبار A/B: رابط واحد يوزّع الزوار على 2–3 صفحات هبوط، وكل زيارة وطلب يُسجَّلان باسم الاختبار
@Entity({ name: 'split_tests' })
export class SplitTest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  storeId: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'storeId' })
  store: Store;

  @Column({ length: 120 })
  name: string;

  // رابط الاختبار بنفس شكل صفحات المحرر: "mystore.mdstore.top/lp/summer-test"
  @Column({ unique: true })
  domain: string;

  @Column({ type: 'jsonb', default: [] })
  variants: SplitVariant[];

  // { [builderPageId]: عدد الزوار الجدد الذين أُعطيت لهم } — للتوزيع المتوازن حسب الأوزان
  @Column({ type: 'jsonb', default: {} })
  assignedCounts: Record<string, number>;

  // متوقف = كل الزوار للفائزة (أو أول صفحة) ولا تُحتسب إحصائيات جديدة
  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'uuid', nullable: true })
  winnerPageId: string | null;

  @Column({ type: 'timestamp', nullable: true })
  endedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
