import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Order } from '../../order/entities/order.entity';

export enum ConfirmationAction {
  SENT = 'sent',           // التاجر أرسل الطلب للشركة
  RECALLED = 'recalled',   // التاجر سحبه قبل أن يأخذه أحد
  CLAIMED = 'claimed',     // موظف أخذه من القائمة المشتركة
  EDITED = 'edited',       // عدّل العنوان/المنتجات
  STATUS = 'status',       // غيّر الحالة
  RELEASED = 'released',   // أعاده للقائمة بدون تغيير
  UPLOADED = 'uploaded',   // رُفع لشركة التوصيل تلقائياً
  UPLOAD_FAILED = 'upload_failed',
  PAID = 'paid',           // دُفعت العمولة بعد التسليم
}

/** سجل كل ما حدث للطلب في مسار التأكيد — للتاجر والشركة وإحصائيات الموظفين */
@Entity({ name: 'confirmation_logs' })
@Index(['companyId', 'createdAt'])
@Index(['agentId', 'createdAt'])
export class ConfirmationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  orderId: string;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({ type: 'uuid' })
  companyId: string;

  /** null = فعل التاجر أو النظام */
  @Column({ type: 'uuid', nullable: true })
  agentId?: string | null;

  @Column({ type: 'enum', enum: ConfirmationAction })
  action: ConfirmationAction;

  @Column({ nullable: true })
  fromStatus?: string;

  @Column({ nullable: true })
  toStatus?: string;

  @Column({ type: 'text', nullable: true })
  note?: string;

  @CreateDateColumn()
  createdAt: Date;
}
