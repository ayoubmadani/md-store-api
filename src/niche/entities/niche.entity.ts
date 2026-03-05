import { Store } from "../../store/entities/store.entity";
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";

@Entity({name : 'niches'})
export class Niche {

    @PrimaryGeneratedColumn('uuid')
    id:string

    @Column()
    name : string

    @Column()
    icon : string

    @OneToMany(()=> Store , (stores)=> stores.niche)
    stores : Store[]
}
