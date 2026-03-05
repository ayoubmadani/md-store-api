import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm"; // أضف Entity هنا
import { Theme } from "./theme.entity";

@Entity() // 👈 هذا هو السطر المفقود الذي يسبب المشكلة
export class ThemeType {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({unique:true})
    name: string;

    @OneToMany(() => Theme, (theme) => theme.types)
    theme: Theme[];
}