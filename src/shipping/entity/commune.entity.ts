import { Column, Entity, ManyToOne, PrimaryColumn, JoinColumn, OneToMany } from "typeorm";
import { Wilaya } from "./wilaya.entity";
import { Order } from "../../order/entities/order.entity";

@Entity({ name: 'communes' }) // تصحيح الاسم
export class Commune {

    // بما أننا نملك معرفات ثابتة للبلديات من ملف الـ JSON، 
    // يفضل استخدام PrimaryColumn بدلاً من التوليد التلقائي
    @PrimaryColumn()
    id: number;

    @Column()
    name: string;

    @Column()
    ar_name: string;

    @Column({ nullable: true })
    post_code: string;

    // إضافة الحقل كـ Column ليسهل عليك التعامل مع الـ ID مباشرة
    @Column()
    wilayaId: number;

    @ManyToOne(() => Wilaya, (wilaya) => wilaya.communes, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'wilayaId' }) // ربط العلاقة بالعمود أعلاه
    wilaya: Wilaya;

    @OneToMany(()=> Order , orders => orders.customerCommune)
    orders: Order[]
}