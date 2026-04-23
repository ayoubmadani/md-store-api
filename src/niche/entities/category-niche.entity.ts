import { Category } from "../../category/entities/category.entity";
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, Tree, TreeChildren, TreeParent } from "typeorm";
import { Niche } from "./niche.entity";

@Entity()
@Tree("materialized-path")
export class CategoryNiche {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name_en: string;

    @Column()
    name_ar: string;

    @Column()
    name_fr: string;

    @Column({ nullable: true })
    imageUrl?: string;

    @TreeChildren()
    children: CategoryNiche[];

    @TreeParent({ onDelete: "CASCADE" }) // ضع التعديلات هنا مباشرة
    parent: CategoryNiche | null;

    // عمود مادي لتخزين الـ ID الخاص بالأب (اختياري ولكن مفيد للطلبات المباشرة)
    @Column({ nullable: true })
    parentId: string | null;

    @OneToMany(() => Category, (category) => category.categoryNiche)
    categorys: Category[];

    @Column()
    nicheId: string;

    @ManyToOne(() => Niche, (niche) => niche.categoryNiches, { onDelete: "CASCADE" })
    @JoinColumn({ name: "nicheId" })
    niche: Niche;
}