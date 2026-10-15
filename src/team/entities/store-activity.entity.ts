import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type ActivityAction = 'create' | 'update' | 'delete' | 'restore';
export type ActivityEntity = 'product' | 'category' | 'domain' | 'order' | 'store' | 'theme' | 'group' | 'member' | 'seo';

// سجل نشاط المتجر (المالك والأعضاء) — يُحفظ 90 يوماً
@Entity({ name: 'store_activities' })
@Index('IDX_store_activities_store_created', ['storeId', 'createdAt'])
export class StoreActivity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  storeId: string;

  // من قام بالعمل (المالك أو العضو)
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'enum', enum: ['create', 'update', 'delete', 'restore'] })
  action: ActivityAction;

  @Column({ type: 'enum', enum: ['product', 'category', 'domain', 'order', 'store', 'theme', 'group', 'member', 'seo'] })
  entity: ActivityEntity;

  @Column({ type: 'uuid' })
  entityId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  entityName: string | null;

  // update: الحقول التي تغيّرت فقط
  @Column({ type: 'jsonb', nullable: true })
  before: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  after: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;
}
