import { Column, Entity, OneToMany, PrimaryColumn } from "typeorm";
import { Commune } from "./commune.entity";
import { Order } from "../../order/entities/order.entity";


@Entity({name : 'wilayas'})
export class Wilaya{

    @PrimaryColumn()
    id:number;

    @Column()
    name:string;

    @Column()
    ar_name:string;

    @OneToMany(()=> Commune , (communes)=> communes.wilaya)
    communes:Commune[]

    @OneToMany(()=> Order , orders => orders.customerWilaya)
    orders: Order[]
}