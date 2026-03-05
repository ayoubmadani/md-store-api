import { Category } from "../../category/entities/category.entity";
import { Niche } from "../../niche/entities/niche.entity";
import { Product } from "../../product/entities/product.entity";
import { User } from "../../user/entities/user.entity";
import { StoreDesign } from "./store-design.entity";
import { StoreTopBar } from "./store-topBar.entity";
import { StoreContact } from "./store-contact.entity";
import { StoreHeroSection } from "./hero-section.entity";
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { StorePixel } from "./store-pixel.entity";
import { Order } from "src/order/entities/order.entity";
import { ThemeUser } from "src/theme/entities/theme-user.entity";

@Entity({ name: 'stores' })
export class Store {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  subdomain: string;

  @Column({ default: 'DZD' })
  currency: string;

  @Column({ default: 'ar' })
  language: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.stores, { onDelete: 'CASCADE' })
  user: User;

  @ManyToOne(() => Niche, (niche) => niche.stores, { onDelete: 'CASCADE' })
  niche: Niche;

  @OneToMany(() => Product, (products) => products.store)
  products: Product[];

  @OneToMany(() => Category, (categories) => categories.store)
  categories: Category[];

  @OneToMany(() => Order, (orders) => orders.store)
  orders: Order[];

  // OneToOne relationships - Store is the OWNER (has @JoinColumn)
  @OneToOne(() => StoreDesign, (design) => design.store, { cascade: true })
  design: StoreDesign;

  @OneToOne(() => StoreTopBar, (topBar) => topBar.store, { cascade: true })
  topBar: StoreTopBar;

  @OneToOne(() => StoreContact, (contact) => contact.store, { cascade: true })
  contact: StoreContact;

  @OneToMany(() => StorePixel, (pixels) => pixels.store, { cascade: true })
  pixels: StorePixel

  @OneToOne(() => StoreHeroSection, (hero) => hero.store, { cascade: true })
  hero: StoreHeroSection;

  // داخل ملف store.entity.ts

  @Column({ nullable: true })
  themeUserId?: string | null;

  // ✅ تغيير من @OneToOne إلى @ManyToOne
  @ManyToOne(() => ThemeUser, (themeUser) => themeUser.stores, {
    onDelete: 'SET NULL', // إذا حذف المستخدم الثيم، يبقى المتجر ولكن بدون ثيم
    nullable: true
  })
  @JoinColumn({ name: "themeUserId" })
  themeUser: ThemeUser;
}