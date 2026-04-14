import { LandingPage } from "src/landing-page/entities/landing-page.entity";
import { Commune } from "../../shipping/entity/commune.entity";
import { Wilaya } from "../../shipping/entity/wilaya.entity";
import { Store } from "../../store/entities/store.entity";
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, OneToMany, JoinColumn
} from "typeorm";
import { OrderItem } from "./order-item.entity";

export enum TypeShipEnum {
  HOME = "home",
  OFFICE = "office"
}

export enum StatusEnum {
  PENDING   = "pending",
  APPL1     = "appl1",
  APPL2     = "appl2",
  APPL3     = "appl3",
  CONFIRMED = "confirmed",
  SHIPPING  = "shipping",
  CANCELLED = "cancelled",
  RETURNED  = "returned",
  DELIVERED = "delivered",
  POSTPONED = "postponed",
}

@Entity({ name: 'orders' })
export class Order {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ── السلة ──────────────────────────────────────────
  @Column({ type: 'uuid', nullable: true })
  cartId: string;

  // ── المتجر ─────────────────────────────────────────
  @Column()
  storeId: string;

  @ManyToOne(() => Store, store => store.orders)
  @JoinColumn({ name: 'storeId' })
  store: Store;

  // ── العميل ─────────────────────────────────────────
  @Column()
  customerId: string;

  @Column()
  customerName: string;

  @Column()
  customerPhone: string;

  @Column()
  customerWilayaId: number;

  @ManyToOne(() => Wilaya, wilaya => wilaya.orders)
  @JoinColumn({ name: 'customerWilayaId' })
  customerWilaya: Wilaya;

  @Column()
  customerCommuneId: number;

  @ManyToOne(() => Commune, commune => commune.orders)
  @JoinColumn({ name: 'customerCommuneId' })
  customerCommune: Commune;

  // ── الشحن ──────────────────────────────────────────
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  priceShip: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  priceLoss: number;

  @Column({ type: 'enum', enum: TypeShipEnum, default: TypeShipEnum.HOME })
  typeShip: TypeShipEnum;

  // ── المجموع الكلي للسلة (مواد فقط، بدون شحن) ──────
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalPrice: number;

  // ── الحالة ─────────────────────────────────────────
  @Column({ type: 'enum', enum: StatusEnum, default: StatusEnum.PENDING })
  status: StatusEnum;

  // ── منصة الطلب ─────────────────────────────────────
  @Column({ nullable: true })
  platform?: string;

  @Column({ nullable: true })
  lpId?: string;

  @ManyToOne(() => LandingPage, lp => lp.orders)
  @JoinColumn({ name: 'lpId' })
  lp?: LandingPage;

  // ── العناصر ────────────────────────────────────────
  @OneToMany(() => OrderItem, item => item.order, { cascade: true, eager: false })
  items: OrderItem[];

  // ── الطوابع الزمنية ────────────────────────────────
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  confirmedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  shippingAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  deliveredAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  postponedUntil: Date;

  @Column({ default: false })
  isUploadedShipping: boolean;
}