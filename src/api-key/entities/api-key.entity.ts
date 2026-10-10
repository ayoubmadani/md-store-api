import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { User } from '../../user/entities/user.entity';

// المفتاح نفسه لا يُخزَّن أبداً — بصمته (sha256) فقط، وأول 8 أحرف منه للعرض.
@Entity('api_keys')
export class ApiKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  keyHash: string;

  @Column({ type: 'varchar', length: 8 })
  prefix: string;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  revokedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  lastUsedAt: Date | null;

  // الذكاء الاصطناعي الذي ارتبط بهذا المفتاح عبر MCP (مثل «claude-ai») ووقت آخر ربط
  @Column({ type: 'varchar', length: 100, nullable: true })
  connectedClient: string | null;

  @Column({ type: 'timestamp', nullable: true })
  connectedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
