import { Column, Entity, PrimaryGeneratedColumn } from "typeorm"


@Entity()
export class Admin{
    @PrimaryGeneratedColumn('uuid')
    id:string

    @Column()
    username:string

    @Column()
    email:string

    @Column()
    key:number

    @Column()
    password:string
}