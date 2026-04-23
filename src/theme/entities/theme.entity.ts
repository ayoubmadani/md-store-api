import { Entity, Column, OneToMany, PrimaryGeneratedColumn, ManyToOne, JoinColumn, OneToOne } from "typeorm";
import { ThemeUser } from "./theme-user.entity";
import { ThemeType } from "./theme-type.entity";
import { ThemePlan } from "./theme-plan.entity";
import { Store } from "src/store/entities/store.entity";

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
    tag: string[];

    @Column()
    typeId: string;

    @Column({ default: false })
    isActive: boolean;

    // ✅ تصحيح 1: العلاقة ManyToOne تعيد كائناً واحداً فقط، لذا نستخدم الاسم المفرد 'type' وليس 'types'
    @ManyToOne(() => ThemeType, (themeType) => themeType.theme, { onDelete: 'CASCADE' })
    @JoinColumn({ name: "typeId" })
    type: ThemeType;

    @OneToMany(() => ThemeUser, (themeUser) => themeUser.theme)
    themeUsers: ThemeUser[];

    // ✅ تصحيح 2: العلاقة OneToMany يجب أن تعيد مصفوفة []ThemePlan لأن الثيم الواحد يمكن أن يرتبط بخطط متعددة
    // ✅ تصحيح 3: تأكد من الربط مع الحقل الصحيح في ThemePlan (يفضل أن يكون اسمه 'theme' كما فعلنا في الرد السابق)
    @OneToMany(() => ThemePlan, (themePlan) => themePlan.theme)
    themePlans: ThemePlan[];

    // تغيير من OneToOne إلى OneToMany
    @OneToMany(() => Store, (store) => store.theme)
    stores: Store[]; // لاحظ الجمع هنا لأنها أصبحت قائمة متاجر
}