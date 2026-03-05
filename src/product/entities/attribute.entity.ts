import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Product } from "./product.entity";
import { Variant } from "./variant.entity";

@Entity('product_attributes')
export class Attribute {
  @PrimaryGeneratedColumn('uuid')
  id: string; // مثال: att-177085...

  @Column()
  name: string; // مثال: "Color"

  @Column()
  type: string; // مثال: "color", "size", "text"

  @Column({ nullable: true })
  displayMode: string; // مثال: "color", "image"

  @ManyToOne(() => Product, (product) => product.attributes, { onDelete: 'CASCADE' })
  product: Product;

  @OneToMany(() => Variant, (v) => v.attribute, { cascade: true })
  variants: Variant[];
}