import { 
    Column, 
    Entity, 
    JoinColumn, 
    ManyToOne, 
    PrimaryGeneratedColumn, 
    CreateDateColumn, 
    UpdateDateColumn 
} from "typeorm";
import { User } from "./user.entity";
import { Store } from "../../store/entities/store.entity";

@Entity()
export class MessageUser {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column()
    phone: string;

    @Column()
    email: string;

    @Column({ type: 'text' })
    message: string;

    // حالة القراءة: false تعني رسالة جديدة
    @Column({ default: false })
    isViewed: boolean;

    // حالة الأرشفة: true تعني أنها في الأرشيف
    @Column({ default: false })
    isArchived: boolean;

    @Column()
    storeId: string;

    @ManyToOne(() => Store, (store) => store.messages)
    @JoinColumn({ name: "storeId" })
    store: Store;

    @Column()
    userId: string;

    @ManyToOne(() => User, (user) => user.messages)
    @JoinColumn({ name: "userId" })
    user: User;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}