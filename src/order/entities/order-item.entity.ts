import {
  Entity, PrimaryGeneratedColumn, Column,
  ManyToOne, JoinColumn, CreateDateColumn
} from "typeorm";
import { Product } from "../../product/entities/product.entity";
import { VariantDetail } from "../../product/entities/variant-detail.entity";
import { Offer } from "../../product/entities/offer.entity";
import { Order } from "./order.entity";

@Entity({ name: 'order_items' })
export class OrderItem {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ── الطلبية الأم ────────────────────────────────────
  @Column()
  orderId: string;

  @ManyToOne(() => Order, order => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  // ── المنتج ──────────────────────────────────────────
  @Column()
  productId: string;

  @ManyToOne(() => Product, { nullable: false })
  @JoinColumn({ name: 'productId' })
  product: Product;

  // ── المتغير (اختياري) ──────────────────────────────
  @Column({ nullable: true })
  variantDetailId?: string;

  @ManyToOne(() => VariantDetail, { nullable: true })
  @JoinColumn({ name: 'variantDetailId' })
  variantDetail?: VariantDetail;

  // ── العرض (اختياري) ────────────────────────────────
  @Column({ nullable: true })
  offerId?: string;

  @ManyToOne(() => Offer, { nullable: true })
  @JoinColumn({ name: 'offerId' })
  offer?: Offer;

  // ── الكمية والأسعار ─────────────────────────────────
  @Column({ default: 1 })
  quantity: number;

  /** سعر الوحدة قبل الضرب في الكمية */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  finalPrice: number;

  /** finalPrice × quantity */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalPrice: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  unityPrice?: number;

  @CreateDateColumn()
  createdAt: Date;
}