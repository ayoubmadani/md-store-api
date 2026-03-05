import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { Store } from "./store.entity";

@Entity({ name: 'store_contacts' })
export class StoreContact {

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  email?: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ nullable: true })
  wilaya?: string;

  @OneToOne(() => Store, (store) => store.contact, { onDelete: 'CASCADE' })
  @JoinColumn()
  store: Store;
}