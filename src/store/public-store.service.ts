import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository, TreeRepository } from "typeorm";
import { Store } from "./entities/store.entity";
import { StorePixel } from "./entities/store-pixel.entity";
import { Category } from "../category/entities/category.entity";
import { Product } from "../product/entities/product.entity";


@Injectable()
export class PublicStoreService {
    constructor(
        private readonly dataSource: DataSource,
        @InjectRepository(Store) private readonly storeRepository: Repository<Store>,
        @InjectRepository(StorePixel) private readonly pixelRepository: Repository<StorePixel>,
        @InjectRepository(Category) private categoryRepository: TreeRepository<Category>,
        @InjectRepository(Product) private productRepository: TreeRepository<Product>,
    ) { }


}