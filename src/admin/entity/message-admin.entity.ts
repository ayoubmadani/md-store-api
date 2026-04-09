import {
    Column, Entity, PrimaryGeneratedColumn, CreateDateColumn
} from "typeorm"



@Entity({ name: "message_admine" })
export class MessageAdmine {
    @PrimaryGeneratedColumn('uuid')
    id: string

    @Column()
    username: string

    @Column()
    email: string

    @Column()
    subject: string 

    @Column('text')
    message: string

    // الحقل الخاص بحالة الرد (تم الرد أم لا)
    @Column({ type: 'boolean', default: false, name: 'is_replied' })
    isReplied: boolean;

    // الحقل الخاص بالأرشفة
    @Column({ type: 'boolean', default: false, name: 'is_archived' })
    isArchived: boolean;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
}