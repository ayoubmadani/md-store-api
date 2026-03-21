import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { Store } from './store.entity';

@Entity({ name: 'store_hero_sections' })
export class StoreHeroSection {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  imageUrl?: string;

  @Column({ nullable: true })
  title?: string;

  @Column({ nullable: true })
  subtitle?: string;

   @Column()
  storeId:string

  @OneToOne(() => Store, (store) => store.hero, { onDelete: 'CASCADE' })
  @JoinColumn({name: "storeId"})
  store: Store;
}