import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Store } from '../../store/entities/store.entity';
import { User } from '../../user/entities/user.entity';
import { StoreGroup } from './store-group.entity';

export type MemberStatus = 'pending' | 'accepted' | 'rejected';

// عضوية مستخدم في متجر غيره — دعوة (pending) ثم قبول/رفض
@Entity({ name: 'store_members' })
@Index('UQ_store_members_store_user', ['storeId', 'userId'], { unique: true })
export class StoreMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  storeId: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'storeId' })
  store: Store;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  // اختياري: يُدعى العضو أولاً ثم يُسند لمجموعة (بلا مجموعة = بلا أي صلاحية)
  @Column({ type: 'uuid', nullable: true })
  groupId: string | null;

  // لا يُحذف مجموعة فيها أعضاء
  @ManyToOne(() => StoreGroup, (g) => g.members, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'groupId' })
  group: StoreGroup;

  @Column({ type: 'enum', enum: ['pending', 'accepted', 'rejected'], default: 'pending' })
  status: MemberStatus;

  @Column({ type: 'uuid' })
  invitedBy: string;

  // معلّق لأن خطة المالك لا تتسع له (يُرفع تلقائياً عند الترقية)
  @Column({ default: false })
  suspendedByPlan: boolean;

  @Column({ type: 'timestamp', nullable: true })
  joinedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
