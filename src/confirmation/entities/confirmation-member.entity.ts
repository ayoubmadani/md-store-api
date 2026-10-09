import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { ConfirmationCompany } from './confirmation-company.entity';

export enum ConfirmationMemberRole {
  OWNER = 'owner', // مدير الشركة: الفريق والأرباح + يؤكد مثل أي موظف
  AGENT = 'agent',
}

/** عضو في شركة تأكيد. المستخدم ينتمي لشركة واحدة فقط. */
@Entity({ name: 'confirmation_members' })
export class ConfirmationMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  companyId: string;

  @ManyToOne(() => ConfirmationCompany, (c) => c.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'companyId' })
  company: ConfirmationCompany;

  @Column({ type: 'uuid', unique: true })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'enum', enum: ConfirmationMemberRole, default: ConfirmationMemberRole.AGENT })
  role: ConfirmationMemberRole;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
