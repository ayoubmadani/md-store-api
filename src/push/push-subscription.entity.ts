import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// هاتف/متصفح سجّل لاستقبال إشعارات تطبيق الهاتف (Web Push) — لكل مستخدم عدة أجهزة
@Entity('push_subscriptions')
export class PushSubscriptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @Index({ unique: true })
  @Column({ type: 'text' })
  endpoint: string;

  @Column({ type: 'varchar', length: 255 })
  p256dh: string;

  @Column({ type: 'varchar', length: 255 })
  auth: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  userAgent: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
