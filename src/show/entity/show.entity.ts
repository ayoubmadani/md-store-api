import {
    Column,
    Entity,
    PrimaryGeneratedColumn,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Unique
} from "typeorm";
import { Product } from "../../product/entities/product.entity";
import { Store } from "../../store/entities/store.entity";
import { LandingPage } from "src/landing-page/entities/landing-page.entity";

@Entity('shows')
@Unique(['visitorId', 'productId', 'storeId', 'dayDate']) // منع التكرار بناءً على هذه المجموعة
export class Show {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ nullable: true })
    productId?: string;

    @Column({ nullable: true })
    storeId?: string;

    @Column({ nullable: true })
    lpId:string


    @Column()
    visitorId: string;

    @Column({ type: 'date', default: () => 'CURRENT_DATE' })
    dayDate: string; // حقل لتخزين "التاريخ فقط" (مثلاً: 2026-03-18)

    @CreateDateColumn()
    createdAt: Date;
    
    // ... العلاقات

    @ManyToOne(() => Store, store => store.shows)
    @JoinColumn({ name: "storeId" })
    store?: Store

    @ManyToOne(() => LandingPage, lp => lp.shows)
    @JoinColumn({ name: "lpId" })
    lp?: LandingPage

    @ManyToOne(() => Product, product => product.shows)
    @JoinColumn({ name: "productId" })
    product?: Product

}