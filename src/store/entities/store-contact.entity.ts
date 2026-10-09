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

  // رقم واتساب المتجر (زر واتساب العائم في واجهة المتجر)
  @Column({ nullable: true })
  whatsapp?: string;

  @Column({ nullable: true })
  wilaya?: string;

  @Column({ type: 'text', nullable: true })
  address?: string;

   @Column()
  storeId:string

  @OneToOne(() => Store, (store) => store.contact, { onDelete: 'CASCADE' })
  @JoinColumn({name :"storeId"})
  store: Store;
}