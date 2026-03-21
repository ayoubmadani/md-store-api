import { Column, Entity, OneToOne, PrimaryGeneratedColumn, JoinColumn } from "typeorm";
import { Store } from "./store.entity";

@Entity({ name: 'store_designs' })
export class StoreDesign {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: '#8b5cf6' })
  primaryColor: string;

  @Column({ default: '#ec4899' })
  secondaryColor: string;

  @Column({ nullable: true })
  logoUrl: string;

  // Removed duplicate hero fields (heroImage, heroTitle, heroSubtitle)
  // These are now handled by StoreHeroSection entity

  @Column()
  storeId:string

  @OneToOne(() => Store, (store) => store.design, { onDelete: 'CASCADE' })
  @JoinColumn({name : "storeId"})
  store: Store;
}