import { Store } from '../../store/entities/store.entity';
import { User } from '../../user/entities/user.entity'; // تأكد من مسار كيان المستخدم لديك
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('store_shipping_settings')
export class StoreShippingSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ─── الربط مع المستخدم (المالك) ───
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  // ─── الربط مع المتجر (السياق) ───
  @ManyToOne(() => Store, { onDelete: 'CASCADE',nullable:true },)
  @JoinColumn({ name: 'store_id' })
  store?: Store;

  @Column({ name: 'store_id' ,nullable:true})
  storeId?: string;

  // ─── بيانات الحساب ───
  @Column({ name: 'account_name', length: 128 })
  accountName: string;

  @Column({ name: 'provider_name', length: 64 })
  providerName: string;

  @Column({ name: 'credentials', type: 'text' })
  credentials: string;

  @Column({ name: 'is_verified', default: false })
  isVerified: boolean;

  @Column({ name: 'is_default', default: false })
  isDefault: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // ─── دوال مساعدة ───
  getParsedCredentials(): Record<string, string> {
    return JSON.parse(this.credentials);
  }

  setCredentials(creds: Record<string, string>): void {
    this.credentials = JSON.stringify(creds);
  }
}