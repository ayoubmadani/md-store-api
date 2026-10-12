import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { SuperAdmin } from './super-admin.entity';

// مفتاح MCP لمدير المنصة (mdsa_...) — منفصل عن مفاتيح التجار (mdk_): لا يفتح إلا مسارات admin-mcp،
// وكل عملية فيها تطلب PIN جديداً. المفتاح نفسه لا يُخزَّن، بصمته (sha256) فقط.
@Entity('super_admin_api_keys')
export class SuperAdminApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  superAdminId: string;

  @ManyToOne(() => SuperAdmin, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'superAdminId' })
  superAdmin: SuperAdmin;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  keyHash: string;

  @Column({ type: 'varchar', length: 9 })
  prefix: string;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  revokedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  lastUsedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
