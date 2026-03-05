import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Product } from './product.entity';
import { Order } from '../../order/entities/order.entity';

/**
 * One attribute slot inside a variant combination.
 * Stored as a JSON array in the `name` column.
 *
 * Examples:
 *  { attrId: "att-1", attrName: "Color", displayMode: "color", value: "#FF0000" }
 *  { attrId: "att-2", attrName: "Size",  displayMode: "text",  value: "XL"      }
 *  { attrId: "att-3", attrName: "Color", displayMode: "image", value: "https://…" }
 */
export interface VariantAttributeEntry {
  attrId: string;
  attrName: string;
  displayMode: 'color' | 'image' | 'text';
  value: string;
}

@Entity('variant_details')
export class VariantDetail {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Stores the full combination as a typed JSON array.
   *
   * Old shape (legacy):  { "Color": "#ff0000", "Size": "S" }
   * New shape:           [{ attrId, attrName, displayMode, value }, …]
   */
  @Column({ type: 'json', nullable: false })
  name: VariantAttributeEntry[];

  @Column({ type: 'float', default: 0 })
  price: number;

  @Column({ type: 'int', default: 0 })
  stock: number;

  @Column({ default: false })
  autoGenerate: boolean;

  @ManyToOne(() => Product, (product) => product.variantDetails, { onDelete: 'CASCADE' })
  product: Product;

  @OneToMany(() => Order, (order) => order.variantDetail)
  orders?: Order[];
}