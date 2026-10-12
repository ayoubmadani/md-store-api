import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

// إعدادات المنصة التي يغيّرها مدير المنصة من لوحة الإدارة (مفتاح ← قيمة)
@Entity('platform_settings')
export class PlatformSetting {
  @PrimaryColumn({ type: 'varchar', length: 100 })
  key: string;

  @Column({ type: 'jsonb' })
  value: unknown;

  @UpdateDateColumn()
  updatedAt: Date;
}
