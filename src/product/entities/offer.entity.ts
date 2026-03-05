import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Product } from "./product.entity";
import { Order } from "../../order/entities/order.entity";

@Entity('product_offers')
export class Offer {
  @PrimaryGeneratedColumn('uuid')
  id: string; // مثال: off-177085...

  @Column()
  name: string;

  @Column('int')
  quantity: number;

  @Column('float')
  price: number;

  @ManyToOne(() => Product, (product) => product.offers, { onDelete: 'CASCADE' })
  product: Product;

  @OneToMany(() => Order, (order) => order.offer)
  orders: Order[];
}