import { Store } from "../../store/entities/store.entity";
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { CategoryNiche } from "./category-niche.entity";

@Entity({name : 'niches'})
export class Niche {

    @PrimaryGeneratedColumn('uuid')
    id:string

    @Column()
    name_en : string

    @Column()
    name_ar : string

    @Column()
    name_fr : string

    @Column()
    slug : string

    @Column()
    icon : string

    @OneToMany(()=> Store , (stores)=> stores.niche)
    stores : Store[]
    
    @OneToMany(()=> CategoryNiche , categoryNiche => categoryNiche.niche )
    categoryNiches:CategoryNiche[]
}
