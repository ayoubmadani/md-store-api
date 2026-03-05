import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToOne, JoinColumn, Unique, OneToMany } from "typeorm";
import { Theme } from "./theme.entity";
import { Store } from "src/store/entities/store.entity";

@Entity()
@Unique(['themeId', 'userId'])
export class ThemeUser {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    themeId: string;

    @Column()
    userId: string;
    
    // هنا العلاقة تعود لثيم واحد فقط، لذا نستخدم Theme وليس Theme[]
    @ManyToOne(() => Theme, (theme) => theme.themeUsers)
    theme: Theme;

    // ✅ تغيير من @OneToOne إلى @OneToMany
    @OneToMany(() => Store, (store) => store.themeUser)
    stores: Store[]; 
}