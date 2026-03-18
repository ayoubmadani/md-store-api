import { LandingPage } from "src/landing-page/entities/landing-page.entity";
import { Offer } from "../../product/entities/offer.entity";
import { Product } from "../../product/entities/product.entity";
import { VariantDetail } from "../../product/entities/variant-detail.entity";
import { Variant } from "../../product/entities/variant.entity";
import { Commune } from "../../shipping/entity/commune.entity";
import { Wilaya } from "../../shipping/entity/wilaya.entity";
import { Store } from "../../store/entities/store.entity";
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from "typeorm";

export enum TypeShipEnum {
  HOME = "home",
  OFFICE = "office"
}

export enum StatusEnum {
  PENDING = "pending",
  APPL1 = "appl1",
  APPL2 = "appl2",
  APPL3 = "appl3",
  CONFIRMED = "confirmed",
  SHIPPING = 'shipping',
  CANCELLED = "cancelled",
  RETURNED = "returned",
  DELIVERED = "delivered",
  POSTPONED = "postponed",
}

@Entity({ name: 'orders' })
export class Order {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  productId:string

  @ManyToOne(() => Product, (product) => product.orders)
  @JoinColumn({name:"productId"})
  product: Product;

  @Column()
  storeId:string

  @ManyToOne(() => Store, (store) => store.orders)
  @JoinColumn({name:"storeId"})
  store : Store

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  priceShip: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  priceLoss:number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalPrice: number;

  @Column({default : 1})
  quantity:number

  @Column({nullable:true})
  platform? :string

  @Column({
    type: "enum",
    enum: TypeShipEnum,
    default: TypeShipEnum.HOME
  })
  typeShip: TypeShipEnum;

  @Column({ type: 'decimal', precision: 10, scale: 2 ,nullable:true})
  unityPrice?: number;

  @Column({nullable : true})
  variantDetailId?:string

  @ManyToOne(() => VariantDetail, (variantDetail) => variantDetail.orders, { nullable: true })
  @JoinColumn({name : "variantDetailId"})
  variantDetail?: VariantDetail;

  @Column({nullable:true})
  offerId?:string

  @ManyToOne(() => Offer, (offer) => offer.orders, { nullable: true })
  @JoinColumn({name : "offerId"})
  offer?: Offer;

  @Column({
    type: "enum",
    enum: StatusEnum,
    default: StatusEnum.PENDING
  })
  status: StatusEnum;

  @Column({ default: false })
  isUploadedShipping: boolean;

  /* Customer Information */
  @Column()
  customerId: string;

  @Column()
  customerName: string;

  @Column()
  customerPhone: string;

  @Column()
  customerWilayaId:number

  @ManyToOne(() => Wilaya, (wilaya) => wilaya.orders)
  @JoinColumn({name : "customerWilayaId"})
  customerWilaya: Wilaya;

  @Column()
  customerCommuneId:number

  @ManyToOne(() => Commune, (commune) => commune.orders)
  @JoinColumn({name: "customerCommuneId"})
  customerCommune: Commune;

  /* Timestamps */
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

  @Column({nullable:true})
  lpId?:string

  @ManyToOne(()=> LandingPage , lp => lp.orders)
  @JoinColumn({name:'lpId'})
  lp?:LandingPage

  @Column({ type: 'timestamp', nullable: true })
  postponedUntil: Date; // التاريخ الذي سيتم فيه إعادة الاتصال أو الشحن
}