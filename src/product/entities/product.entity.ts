import { LandingPage } from '../../landing-page/entities/landing-page.entity';
import { Store } from '../../store/entities/store.entity';
import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { Exclude, Transform } from 'class-transformer';
import { Attribute } from './attribute.entity';
import { VariantDetail } from './variant-detail.entity';
import { Offer } from './offer.entity';
import { ImageProduct } from '../../image-product/entities/image-product.entity';
import { Category } from '../../category/entities/category.entity';
import { Order } from '../../order/entities/order.entity';

@Entity({ name: 'products' })
@Index(['store', 'category'])
@Index(['store', 'isActive'])
export class Product {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  desc?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  priceOriginal?: number;

  @Column({ nullable: true })
  productImage?: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 0 })
  stock: number;

  @Column({ nullable: true })
  sku?: string;

  @Column({ nullable: true })
  slug?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt?: Date;

  // ── Relations ──────────────────────────────────────────────────────────────

  @Transform(({ value }) =>
    value ? { id: value.id, name: value.name, subdomain: value.subdomain, logo: value.logo } : null,
  )
  @ManyToOne(() => Store, (store) => store.products, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  store: Store;

  @Transform(({ value }) =>
    value ? { id: value.id, name: value.name } : null,
  )
  @ManyToOne(() => Category, (category) => category.products, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  category?: Category;

  @Exclude()
  @OneToMany(() => LandingPage, (lp) => lp.product)
  landingPages: LandingPage[];

  @OneToMany(() => ImageProduct, (img) => img.product, { cascade: true })
  imagesProduct: ImageProduct[];

  @OneToMany(() => Attribute, (attr) => attr.product, { cascade: true })
  attributes: Attribute[];

  /**
   * ✅ ONE product → MANY variant details.
   * The FK `productId` lives on the variant_details table, not here.
   * Removed: @ManyToOne, @JoinColumn, and the stray `variantDetailId` column.
   */
  @OneToMany(() => VariantDetail, (vd) => vd.product, { cascade: true })
  variantDetails: VariantDetail[];

  /**
   * ✅ ONE product → MANY offers.
   * The FK `productId` lives on the offers table, not here.
   * Removed: @ManyToOne, @JoinColumn, and the stray `offerId` column.
   */
  @OneToMany(() => Offer, (offer) => offer.product, { cascade: true })
  offers: Offer[];

  @Exclude()
  @OneToMany(() => Order, (order) => order.product)
  orders: Order[];
}