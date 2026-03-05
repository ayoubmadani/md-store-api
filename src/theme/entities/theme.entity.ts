import { Entity, Column, OneToMany, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from "typeorm";
import { ThemeUser } from "./theme-user.entity";
import { ThemeType } from "./theme-type.entity";

@Entity()
export class Theme {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name_en: string;

    @Column()
    name_ar: string;

    @Column()
    name_fr: string;

    @Column({ unique: true })
    slug: string;

    @Column({ type: 'float', default: 0 })
    price: number;

    @Column({ type: 'text' })
    desc_en: string;

    @Column({ type: 'text' })
    desc_ar: string;

    @Column({ type: 'text' })
    desc_fr: string;

    @Column()
    imageUrl: string;

    @Column({ type: 'json', nullable: true })
    tag: string[]; // أو any

    // ✅ هذا هو العمود الذي سيخزن الـ ID في قاعدة البيانات
    @Column()
    typeId: string;

    @Column({default : false})
    isActive:boolean

    // ✅ ربط العلاقة بالعمود أعلاه
    @ManyToOne(() => ThemeType, (themeType) => themeType.theme, { onDelete: 'CASCADE' })
    @JoinColumn({ name: "typeId" })
    types: ThemeType;

    @OneToMany(() => ThemeUser, (themeUser) => themeUser.theme)
    themeUsers: ThemeUser[];
}