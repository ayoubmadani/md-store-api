import { CategoryNiche } from "../../niche/entities/category-niche.entity";
import { Product } from "../../product/entities/product.entity";
import { Store } from "../../store/entities/store.entity";
import {
    Column,
    Entity,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
    TreeChildren,
    TreeParent,
    Tree,
    CreateDateColumn,
    UpdateDateColumn,
    DeleteDateColumn,
    Index,
    JoinColumn,
} from "typeorm";

@Entity({ name: 'categories' })
@Tree("materialized-path")
@Index(['store', 'isActive']) // فهرس للأداء
@Index(['store', 'parent']) // فهرس للاستعلامات الهرمية
export class Category {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column({ nullable: true })
    description: string;

    @Column({ nullable: true })
    imageUrl: string;

    @TreeChildren()
    children: Category[];

    @TreeParent()
    parent: Category | null;

    @ManyToOne(() => Store, (store) => store.categories, {
        onDelete: 'CASCADE',
        nullable: false
    })
    store: Store;

    @OneToMany(() => Product, (product) => product.category)
    products: Product[];

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;

    @DeleteDateColumn()
    deletedAt: Date;

    @Column({ default: true })
    isActive: boolean;

    @Column({ default: 0 })
    sortOrder: number;

    @Column({ nullable: true })
    slug: string; // للـ SEO

    @Column({ nullable: true })
    categoryNicheId?:string

    @ManyToOne(() => CategoryNiche, (categoryNiche) => categoryNiche.categorys, {
        onDelete: 'SET NULL', // عند حذف الـ Niche، يتم تحويل القيمة في Category إلى Null ولا تُحذف الفئة
        nullable: true        // يجب أن يكون الحقل يقبل القيمة Null ليعمل SET NULL
    })
    @JoinColumn({name: "categoryNicheId"})
    categoryNiche: CategoryNiche;
}