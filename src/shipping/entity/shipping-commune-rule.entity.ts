import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from "typeorm";
import { ShippingProfile } from "./shipping-profile.entity";
import { Commune } from "./commune.entity";

// استثناءات البلديات داخل حساب شحن: البلدية غير الموجودة هنا تتبع إعداد ولايتها.
// homeEnabled=false و officeEnabled=false ← البلدية معطّلة بالكامل.
@Entity({ name: 'shipping_commune_rules' })
@Unique(['profileId', 'communeId'])
export class ShippingCommuneRule {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    profileId: string;

    @ManyToOne(() => ShippingProfile, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'profileId' })
    profile: ShippingProfile;

    @Column()
    communeId: number;

    @ManyToOne(() => Commune, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'communeId' })
    commune: Commune;

    // نخزّن الولاية أيضاً لجلب استثناءات ولاية واحدة بسرعة
    @Column()
    wilayaId: number;

    @Column({ default: false })
    homeEnabled: boolean;

    @Column({ default: false })
    officeEnabled: boolean;
}
