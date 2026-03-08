import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity('subscriptions')
export class Subscription {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string; // 'free' | 'pro'

    @Column({ type: 'decimal', precision: 10, scale: 2 })
    price: number;
}