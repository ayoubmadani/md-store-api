import { Wallet } from '../../payment/entities/wallets.entity';
import { Image } from '../../image/entities/image.entity';
import { Shipping } from '../../shipping/entity/shipping.entity';
import { Store } from '../../store/entities/store.entity';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, OneToOne } from 'typeorm';
import { Transaction } from '../../payment/entities/transaction.entity';

export enum AuthProvider {
    CREDENTIALS = 'CREDENTIALS',
    GOOGLE = 'GOOGLE',
    CREDENTIALS_GOOGLE = 'CREDENTIALS_GOOGLE'
}

export enum UserRole {
    NORMAL_USER = 'NORMAL_USER',
    ADMIN = 'ADMIN',
}

@Entity({ name: 'users' })
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    username: string;

    @Column({ unique: true })
    email: string;

    @Column({ nullable: true })
    phone: string;

    @Column({
        type: 'enum',
        enum: AuthProvider,
        default: AuthProvider.CREDENTIALS,
    })
    provider: AuthProvider;

    @Column({
        type: 'enum',
        enum: UserRole,
        default: UserRole.NORMAL_USER,
    })
    role: UserRole;

    @Column({nullable:true , unique: true})
    topic?:string

    @Column({default: true})
    isNtfy:boolean

    @Column({ nullable: true })
    password?: string;

    @Column({ nullable: true }) // جعلتها nullable لسهولة التحكم
    image: string;

    // حقل الـ OTP
    @Column({ nullable: true })
    otp: number;

    @Column({ default: false })
    isVerified: boolean;

    // حقل تاريخ صلاحية الـ OTP
    @Column({ type: 'timestamp with time zone', nullable: true })
    otpExpires: Date;

    @CreateDateColumn({ type: 'timestamp with time zone' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamp with time zone' })
    updatedAt: Date;

    @OneToMany(() => Store, (stores) => stores.user)
    stores: Store[]

    @OneToMany(() => Image, (images) => images.user)
    images: Image[]

    // داخل user.entity.ts
    @OneToMany(() => Shipping, (shipping) => shipping.user)
    shippings: Shipping[];

    @OneToOne(() => Wallet, (wallet) => wallet.user)
    wallet: Wallet;

    @OneToMany(() => Transaction, (transaction) => transaction.user)
    transactions: Transaction[];
}