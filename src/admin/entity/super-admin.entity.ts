import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// مدير المنصة (لوحة md-store-admin) — منفصل تماماً عن جدول users:
// لا يملك متاجر، ودور ADMIN في users لا يعطي أي صلاحية على المنصة.
@Entity('super_admins')
export class SuperAdmin {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // إيميل حساب Google الذي يدخل به
  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  name: string;

  // رموز PIN نفسها في .env (SUPER_ADMIN_PINS) — هنا فقط عدّاد المحاولات الخاطئة
  @Column({ default: 0 })
  pinAttempts: number;

  @Column({ type: 'timestamp', nullable: true })
  pinLockedUntil: Date | null;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
