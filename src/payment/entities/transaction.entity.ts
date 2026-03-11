import { User } from '../../user/entities/user.entity';
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, JoinColumn } from 'typeorm';

export enum TransactionAction {
    WITHDRAW = 'withdraw',
    TOP_UP = 'deposit'
}

export enum TransactionType {
    SUB = 'subscription',
    THEME = 'sell theme',
    WALLET = 'top up wallet'
}

@Entity('transactions')
export class Transaction {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'enum', enum: TransactionAction })
    action: TransactionAction;

    @Column({ type: 'enum', enum: TransactionType })
    type: TransactionType;

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    amount: number;

    @Column({ nullable: true })
    typeId: number; // معرف الاشتراك أو الثيم

    @Column()
    userId:string

    @ManyToOne(() => User, (user) => user.transactions)
    @JoinColumn({name : "userId"})
    user: User;

    @CreateDateColumn()
    createdAt: Date;
}