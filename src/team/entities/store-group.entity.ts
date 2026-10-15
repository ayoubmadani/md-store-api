import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Store } from '../../store/entities/store.entity';
import { StoreMember } from './store-member.entity';

// مجموعة صلاحيات داخل متجر واحد (مثلاً: «فريق الطلبات») — الأعضاء يُربطون بمجموعة
@Entity({ name: 'store_groups' })
@Index('UQ_store_groups_store_name', ['storeId', 'name'], { unique: true })
export class StoreGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  storeId: string;

  @ManyToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'storeId' })
  store: Store;

  @Column({ length: 80 })
  name: string;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  permissions: string[];

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => StoreMember, (m) => m.group)
  members: StoreMember[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
