import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Show } from '../../show/entity/show.entity';
import { Order } from '../../order/entities/order.entity';

@Entity({ name: 'builder_pages' })
export class BuilderPage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  storeId: string;

  // Which product this page is for — optional, since a page can be
  // general content not tied to one product; also independent of any
  // productForm block's own productId inside the tree.
  @Column({ nullable: true })
  productId: string;

  // Full publish path, e.g. "mystore.mdstore.top/lp/summer-sale" — set at
  // creation time, mirrors the existing landing-pages module's URL shape
  // (see api/src/landing-page) but is this feature's own, separate column.
  @Column({ nullable: true, unique: true })
  domain: string;

  // Ad-campaign source tag (e.g. "tiktok", "facebook") and a soft on/off
  // switch — same fields/semantics as LandingPage's, so the dashboard list
  // can show both features with one UI.
  @Column({ default: 'md store' })
  platform: string;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => Show, (show) => show.builderPage)
  shows: Show[];

  @OneToMany(() => Order, (order) => order.builderPage)
  orders: Order[];

  @Column({ type: 'jsonb', default: [] })
  tree: Record<string, any>[];

  // Page-wide styling that applies to the whole block stack at once
  // (background color, max width, padding) — separate from any individual
  // block's own props, so a merchant sets it once instead of repeating the
  // same container styling on every block that wants it.
  @Column({ type: 'jsonb', default: {} })
  settings: Record<string, any>;

  @Column({ nullable: true })
  publishedUrl: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
