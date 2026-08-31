import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { Store } from "../../store/entities/store.entity";
import { BuilderPage } from "../../builder-pages/entities/builder-page.entity";

export type DomainScope = 'store' | 'landing_page';

@Entity('domains')
export class Domain {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    domain: string; // مثال: boutique-ghazali.mdstore.top أو custom-client.com

    @Column()
    storeId: string;

    @CreateDateColumn()
    createAt: Date;

    // domain.entity.ts

    @ManyToOne(() => Store, (store) => store.domains, { onDelete: 'CASCADE' }) // أضفنا هذا الجزء
    @JoinColumn({ name: "storeId" })
    store: Store;

    @Column({ default: false })
    isActive: boolean

    @Column({ default: false })
    isSub: boolean

    @Column({ nullable: true })
    cloudflareId: string

    // 'store' (الافتراضي) يعرض المتجر كاملاً عند زيارة الدومين، مثل اليوم.
    // 'landing_page' يجعل الدومين بأكمله مخصصاً لصفحة محرر واحدة فقط —
    // الجذر (وأي مسار آخر) يعرض تلك الصفحة حصرياً بدل المتجر.
    @Column({ type: 'enum', enum: ['store', 'landing_page'], default: 'store' })
    scope: DomainScope;

    @ManyToOne(() => BuilderPage, { onDelete: 'SET NULL', nullable: true })
    @JoinColumn({ name: 'builderPageId' })
    builderPage?: BuilderPage;

    @Column({ type: 'uuid', nullable: true })
    builderPageId?: string;
}