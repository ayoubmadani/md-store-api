import { Store } from '../../store/entities/store.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('store_shipping_settings')
export class StoreShippingSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Store, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column({ name: 'store_id' })
  storeId: string;

  /**
   * Provider name key — must match a key in PROVIDER_REGISTRY
   * e.g. "Yalidine", "Dhd", "ZRExpress"
   */
  @Column({ name: 'provider_name', length: 64 })
  providerName: string;

  /**
   * Credentials stored as encrypted JSON string
   * e.g. { "token": "...", "id": "..." }
   * 
   * Encrypt before save, decrypt after load using a NestJS lifecycle hook
   * or a custom transformer.
   */
  @Column({ name: 'credentials', type: 'text' })
  credentials: string;

  /**
   * Whether credentials have been verified
   */
  @Column({ name: 'is_verified', default: false })
  isVerified: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // ─── Helper ───────────────────────────────────────────────────────────────

  getParsedCredentials(): Record<string, string> {
    return JSON.parse(this.credentials);
  }

  setCredentials(creds: Record<string, string>): void {
    this.credentials = JSON.stringify(creds);
  }
}