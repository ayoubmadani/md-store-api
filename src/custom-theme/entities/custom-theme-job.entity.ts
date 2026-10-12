import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { CustomThemeOrder } from './custom-theme-order.entity';

export type CustomThemeJobKind = 'create' | 'revision';
// queued: أُرسل لـ Claude (Batches API) · review: جاهز وينتظر وقت النشر أو موافقة الأدمن
// live: منشور على المتجر · failed: فشل بعد المحاولات (يُسترجع ما دُفع) · rejected: رفضه الأدمن (يُسترجع)
export type CustomThemeJobStatus = 'queued' | 'review' | 'live' | 'failed' | 'rejected';

// طلب واحد لـ Claude: إنشاء الثيم أو مراجعة (تعديل) عليه
@Entity('custom_theme_jobs')
export class CustomThemeJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  orderId: string;

  @ManyToOne(() => CustomThemeOrder, (o) => o.jobs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: CustomThemeOrder;

  @Column({ type: 'varchar', length: 20 })
  kind: CustomThemeJobKind;

  @Column({ type: 'varchar', length: 20, default: 'queued' })
  status: CustomThemeJobStatus;

  // وصف التاجر لما يريده (أو للتعديل المطلوب)
  @Column({ type: 'text' })
  request: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  batchId: string | null;

  // محاولات Claude (الأولى + إصلاح أخطاء البناء)
  @Column({ default: 0 })
  attempts: number;

  @Column({ type: 'text', nullable: true })
  code: string | null;

  @Column({ type: 'text', nullable: true })
  bundle: string | null;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  // ما دُفع لهذا الطلب من المحفظة (يُسترجع عند الفشل أو الرفض)؛ المراجعة المجانية = 0
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  charged: number;

  @Column({ default: false })
  usedFreeRevision: boolean;

  @Column({ type: 'timestamp', nullable: true })
  readyAt: Date | null;

  // يُنشر تلقائياً بعد هذا الوقت ما لم يرفضه الأدمن (أو يوافق قبله)
  @Column({ type: 'timestamp', nullable: true })
  liveAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  lastCheckedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
