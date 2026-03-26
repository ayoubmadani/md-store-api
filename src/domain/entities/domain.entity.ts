import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { Store } from "../../store/entities/store.entity";

@Entity('domains')
export class Domain {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    domain: string; // مثال: boutique-ghazali.mdstore.top أو custom-client.com

    @Column()
    storeId: string;

    @CreateDateColumn()
    createAt: Date;

    @ManyToOne(() => Store, (store) => store.domains)
    @JoinColumn({name : "storeId"})
    store: Store;

    @Column({default : false})
    isActive:boolean

    @Column({nullable:true})
    cloudflareId:string
}