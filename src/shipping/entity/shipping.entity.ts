import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from "typeorm";
import { Wilaya } from "./wilaya.entity";
import { ShippingProfile } from "./shipping-profile.entity";
import { User } from "../../user/entities/user.entity";

@Entity({ name: 'shippings' })
@Unique(['profileId', 'wilayaId'])
export class Shipping {
    
    @PrimaryGeneratedColumn('uuid') // استخدام UUID للمعرفات الخاصة بالشحن أكثر أماناً
    id: string;

    @Column()
    userId:string


    @ManyToOne(()=> User , (user)=> user.shippings)
    @JoinColumn({ name: 'userId' })
    user : User

    // حساب الشحن الذي ينتمي له هذا السعر (لكل حساب أسعاره وولاياته)
    @Column({ type: 'uuid' })
    profileId: string;

    @ManyToOne(() => ShippingProfile, (p) => p.rates, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'profileId' })
    profile: ShippingProfile;

    @Column()
    wilayaId: number;

    @Column({default: true})
    isActive:boolean

    // ربط سعر الشحن بالولاية (69 ولاية)
    @ManyToOne(() => Wilaya)
    @JoinColumn({ name: 'wilayaId' })
    wilaya: Wilaya;

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    priceHome: number; // سعر التوصيل للمنزل

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    priceOffice: number; // سعر التوصيل للمكتب (Yalidine/ZR الخ)

    @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
    priceReturn: number; // سعر الإرجاع في حال فشل التوصيل
}