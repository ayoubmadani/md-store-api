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
import { LandingPage } from "../../landing-page/entities/landing-page.entity";

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

    @ManyToOne(() => Store, store => store.shows, { onDelete: "CASCADE" }) // 👈 أضفنا هذا الجزء
    @JoinColumn({ name: "storeId" })
    store?: Store

    @ManyToOne(() => LandingPage, lp => lp.shows, { onDelete: "CASCADE" }) // 👈 يفضل إضافتها هنا أيضاً
    @JoinColumn({ name: "lpId" })
    lp?: LandingPage

    @ManyToOne(() => Product, product => product.shows, { onDelete: "CASCADE" }) // 👈 وهنا أيضاً لضمان سلامة البيانات
    @JoinColumn({ name: "productId" })
    product?: Product

}