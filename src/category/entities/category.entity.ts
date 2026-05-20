import { CategoryNiche } from "../../niche/entities/category-niche.entity";
import { Product } from "../../product/entities/product.entity";
import { Store } from "../../store/entities/store.entity";
import {
    Column, Entity, ManyToOne, OneToMany,
    PrimaryGeneratedColumn, CreateDateColumn,
    UpdateDateColumn, DeleteDateColumn, Index, JoinColumn,
} from "typeorm";

@Entity({ name: 'categories' })
@Index(['storeId', 'isActive'])
export class Category {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column({ nullable: true })
    description: string;

    @Column({ nullable: true })
    imageUrl: string;

    @Column({ nullable: true })
    parentId: string | null;

    @ManyToOne(() => Category, (cat) => cat.children, {
        nullable: true,
        onDelete: 'CASCADE', // حذف الأب يحذف الأبناء
    })
    @JoinColumn({ name: 'parentId' })
    parent: Category | null;

    @OneToMany(() => Category, (cat) => cat.parent)
    children: Category[];

    @Column()
    storeId: string;

    @ManyToOne(() => Store, (store) => store.categories, {
        onDelete: 'CASCADE',
        nullable: false,
    })
    @JoinColumn({ name: 'storeId' })
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
    slug: string;

    @Column({ nullable: true })
    categoryNicheId?: string;

    @ManyToOne(() => CategoryNiche, (categoryNiche) => categoryNiche.categorys, {
        onDelete: 'SET NULL',
        nullable: true,
    })
    @JoinColumn({ name: "categoryNicheId" })
    categoryNiche: CategoryNiche;
}