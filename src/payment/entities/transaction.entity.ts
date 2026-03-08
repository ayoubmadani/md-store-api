import { User } from '../../user/entities/user.entity';
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, JoinColumn } from 'typeorm';

export enum TransactionAction {
    BUY = 'buy',
    TOP_UP = 'topUp'
}

export enum TransactionType {
    SUB = 'sub',
    THEME = 'theme',
    WALLET = 'wallet'
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