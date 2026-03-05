// src/stores/entities/store-pixel.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Store } from './store.entity';

export type PixelType = 'facebook' | 'tiktok' | 'google' | 'snapchat';

@Entity('store_pixels')
export class StorePixel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: ['facebook', 'tiktok', 'google', 'snapchat'],
    default: 'facebook',
  })
  type: PixelType;

  @Column({ type: 'varchar', length: 255 })
  pixelId: string; // معرف الـ Pixel (مثال: 1234567890)

  @Column({ type: 'varchar', length: 255, nullable: true })
  accessToken?: string; // Facebook Access Token (للـ Conversion API)

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'json', nullable: true })
  events?: string[]; // الأحداث المُفعّلة (PageView, Purchase, etc.)

  @Column({ type: 'json', nullable: true })
  customData?: Record<string, any>; // بيانات مخصصة إضافية

  @ManyToOne(() => Store, (store) => store.pixels, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'storeId' })
  store: Store;

  @Column({ type: 'uuid' })
  storeId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}