import { CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Column, Unique } from 'typeorm';
import { Store } from '../../store/entities/store.entity';
import { ConfirmationCompany } from './confirmation-company.entity';

/** قائمة التاجر: شركات التأكيد التي حفظها متجره ليرسل لها الطلبات */
@Entity({ name: 'store_confirmation_companies' })
@Unique(['storeId', 'companyId'])
export class StoreConfirmationCompany {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  storeId: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'storeId' })
  store: Store;

  @Column({ type: 'uuid' })
  companyId: string;

  @ManyToOne(() => ConfirmationCompany, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company: ConfirmationCompany;

  // حساب التوصيل (من حسابات التاجر) الذي تُرفع به الطلبات التي تؤكدها هذه الشركة
  @Column({ type: 'uuid', nullable: true })
  shippingAccountId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
