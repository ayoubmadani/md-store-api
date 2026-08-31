import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Store } from './store.entity';
import { LandingPage } from '../../landing-page/entities/landing-page.entity';
import { BuilderPage } from '../../builder-pages/entities/builder-page.entity';

export type PixelType = 'facebook' | 'tiktok' | 'google' | 'snapchat';
export type PixelScope = 'store' | 'landing_page';

@Entity('store_pixels')
export class StorePixel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  name?: string; // اسم وصفي اختياري لتمييز البكسلات المتعددة

  @Column({
    type: 'enum',
    enum: ['facebook', 'tiktok', 'google', 'snapchat'],
    default: 'facebook',
  })
  type: PixelType;

  @Column({ type: 'varchar', length: 255 })
  pixelId: string; // معرف الـ Pixel (مثال: 1234567890)

  @Column({
    type: 'enum',
    enum: ['store', 'landing_page'],
    default: 'store',
  })
  scope: PixelScope; // أين يعمل هذا البكسل

  // Legacy — set only by pixels created before the page-builder editor
  // existed, back when the old single-product LandingPage module was the
  // only "landing page" concept. No longer reachable from any dashboard UI
  // (see builderPage below), kept only so those old rows keep working.
  @ManyToOne(() => LandingPage, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'landingPageId' })
  landingPage?: LandingPage;

  @Column({ type: 'uuid', nullable: true })
  landingPageId?: string;

  // Set when a pixel is created from inside the page-builder editor —
  // the live way to get a landing_page-scoped pixel today.
  @ManyToOne(() => BuilderPage, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'builderPageId' })
  builderPage?: BuilderPage;

  @Column({ type: 'uuid', nullable: true })
  builderPageId?: string;

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