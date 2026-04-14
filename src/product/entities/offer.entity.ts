import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Product } from "./product.entity";
import { Order } from "../../order/entities/order.entity";
import { OrderItem } from "../../order/entities/order-item.entity";

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

  // تغيير العلاقة من Order إلى OrderItem
  @OneToMany(() => OrderItem, (orderItem) => orderItem.offer)
  orderItems: OrderItem[];
}