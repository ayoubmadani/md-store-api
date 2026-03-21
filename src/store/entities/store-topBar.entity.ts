import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Store } from "./store.entity";

@Entity({ name: 'store_topbars' })
export class StoreTopBar {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: true })
  enabled: boolean;

  @Column({ nullable: true })
  text: string;

  @Column({ default: '#6366f1' })
  color: string;

  @Column()
  storeId:string

  @OneToOne(() => Store, (store) => store.topBar, { onDelete: 'CASCADE' })
  @JoinColumn({name : "storeId"})
  store: Store;
}