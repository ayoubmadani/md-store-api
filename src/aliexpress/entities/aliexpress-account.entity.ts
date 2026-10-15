import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { User } from '../../user/entities/user.entity';

// ربط حساب AliExpress بمستخدم المنصة (OAuth) — يُستعمل لجلب معلومات المنتجات
@Entity('aliexpress_accounts')
export class AliexpressAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // حساب المنصة يُربط من لوحة الأدمن (مدير المنصة ليس مستخدماً) ← بلا userId
  @Column({ type: 'uuid', unique: true, nullable: true })
  userId: string | null;

  // حساب المنصة الذي يستعمله كل التجار للجلب
  @Column({ type: 'boolean', default: false })
  isPlatform: boolean;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'text' })
  accessToken: string;

  @Column({ type: 'text', nullable: true })
  refreshToken: string | null;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  refreshExpiresAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  account: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
