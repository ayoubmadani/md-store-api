import { Show } from "../../show/entity/show.entity";
import { Product } from "../../product/entities/product.entity";
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Order } from "../../order/entities/order.entity";


@Entity({ name: 'landing-pages' })
export class LandingPage {

    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column({ unique: true })
    domain: String

    @Column()
    urlImage: string

    @Column()
    productId: string;

    @ManyToOne(() => Product, (product) => product.landingPages, { onDelete: 'CASCADE' })
    @JoinColumn({ name: "productId" })
    product: Product

    @Column({ default: "md store" })
    platform: string

    @Column({ default: true })
    isActive: boolean

    @OneToMany(() => Show, show => show.lp)
    shows: Show[]

    @OneToMany(()=> Order ,orders => orders.lp)
    orders:Order[]
}
