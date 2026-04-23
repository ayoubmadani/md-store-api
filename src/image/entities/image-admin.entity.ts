import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class ImageAdmin {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    url: string;

    @Column()
    size: number

    @Column()
    key: string;

    @CreateDateColumn()
    createdAt: Date;
}