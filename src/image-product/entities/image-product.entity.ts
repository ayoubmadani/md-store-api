import { Product } from "../../product/entities/product.entity";
import { User } from "../../user/entities/user.entity";
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";


@Entity({ name: 'product-images' })
export class ImageProduct {

    @PrimaryGeneratedColumn('uuid')
    id: number

    @Column()
    imageUrl: string

    @Column({ type: 'int', default: 0 })
    order: number

    @ManyToOne(() => Product, (product) => product.imagesProduct, { onDelete: 'CASCADE' })
    product: Product;
}
