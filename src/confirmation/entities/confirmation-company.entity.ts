import {
  Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Wilaya } from '../../shipping/entity/wilaya.entity';
import { ConfirmationMember } from './confirmation-member.entity';

export enum ConfirmationCompanyStatus {
  PENDING = 'pending',     // بانتظار موافقة الأدمن — لا تظهر للتجار
  APPROVED = 'approved',
  SUSPENDED = 'suspended',
}

/**
 * شركة تأكيد طلبيات (أو مؤكّد يعمل وحده = شركة بعضو واحد).
 * تظهر في القائمة العامة للتجار بعد موافقة الأدمن.
 */
@Entity({ name: 'confirmation_companies' })
@Index(['status'])
export class ConfirmationCompany {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column()
  phone: string;

  @Column({ nullable: true })
  logo?: string;

  @Column({ nullable: true })
  wilayaId?: number;

  @ManyToOne(() => Wilaya, { nullable: true })
  @JoinColumn({ name: 'wilayaId' })
  wilaya?: Wilaya;

  /** ما يدفعه التاجر عن كل طلب مسلَّم (د.ج) — يُثبَّت على الطلب وقت الإرسال */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  commissionPerDelivered: number;

  @Column({ type: 'enum', enum: ConfirmationCompanyStatus, default: ConfirmationCompanyStatus.PENDING })
  status: ConfirmationCompanyStatus;

  /** صاحب الشركة — تُضاف أرباحها إلى محفظته */
  @Column({ type: 'uuid' })
  ownerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @OneToMany(() => ConfirmationMember, (m) => m.company)
  members: ConfirmationMember[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
