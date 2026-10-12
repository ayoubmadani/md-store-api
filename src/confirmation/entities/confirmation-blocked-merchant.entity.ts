import { CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Column, Unique } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { ConfirmationCompany } from './confirmation-company.entity';

/** تاجر أوقفته شركة التأكيد: لا يستطيع إرسال طلبات جديدة لها من أي متجر من متاجره */
@Entity({ name: 'confirmation_blocked_merchants' })
@Unique(['companyId', 'merchantId'])
export class ConfirmationBlockedMerchant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  companyId: string;

  @ManyToOne(() => ConfirmationCompany, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company: ConfirmationCompany;

  @Column({ type: 'uuid' })
  merchantId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merchantId' })
  merchant: User;

  @CreateDateColumn()
  createdAt: Date;
}
