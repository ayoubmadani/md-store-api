import { Product } from "../../product/entities/product.entity";
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";


@Entity({name : 'landing-pages'})
export class LandingPage {

    @PrimaryGeneratedColumn('uuid')
    id : string

    @Column({unique:true})
    domain :String

    @Column()
    urlImage:string

    @Column()
    productId:string;

    @ManyToOne(()=> Product , (product)=> product.landingPages , { onDelete: 'CASCADE' })
    @JoinColumn({name : "productId"})
    product:Product

    @Column({default:"md store"})
    platform : string
}
