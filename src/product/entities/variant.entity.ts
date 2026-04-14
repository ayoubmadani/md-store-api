import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Attribute } from "./attribute.entity";
import { Order } from "../../order/entities/order.entity";

@Entity('product_variants')
export class Variant {
  @PrimaryGeneratedColumn('uuid')
  id: string; // مثال: var-177085...

  @Column()
  name: string; // القيمة المعروضة

  @Column()
  value: string; // القيمة الفعلية (كود اللون أو النص)

  @ManyToOne(() => Attribute, (attr) => attr.variants, { onDelete: 'CASCADE' })
  attribute: Attribute;
}