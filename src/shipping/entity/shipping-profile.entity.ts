import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { User } from "../../user/entities/user.entity";
import { Shipping } from "./shipping.entity";

// «حساب شحن» باسم يختاره التاجر: مجموعة أسعار وولايات مستقلة.
// لكل تاجر حساب افتراضي واحد (isDefault) تستعمله كل متاجره ما لم يُختر لها حساب آخر.
@Entity({ name: 'shipping_profiles' })
export class ShippingProfile {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    userId: string;

    @ManyToOne(() => User, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column()
    name: string;

    @Column({ default: false })
    isDefault: boolean;

    @OneToMany(() => Shipping, (s) => s.profile)
    rates: Shipping[];

    @CreateDateColumn()
    createdAt: Date;
}
