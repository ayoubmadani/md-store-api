import { User } from '../../user/entities/user.entity';
import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, UpdateDateColumn } from 'typeorm';


@Entity('wallets')
export class Wallet {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    balance: number;

    @Column()
    userId:string;

    @OneToOne(() => User, (user) => user.wallet)
    @JoinColumn({name : 'userId'})
    user: User;

    @UpdateDateColumn()
    updatedAt: Date;
}