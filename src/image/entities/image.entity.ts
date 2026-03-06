import { User } from '../../user/entities/user.entity';
import { 
  Entity, 
  Column, 
  PrimaryGeneratedColumn, 
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
} from 'typeorm';

@Entity({ name: 'images' })
export class Image {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  url: string; // رابط الصورة على S3

  @Column()
  key: string; // مفتاح الملف في S3 (للحذف لاحقاً) مثل: products/uuid.jpg

  @ManyToOne(()=> User , (user)=> user.images)
  user :User

  @Column({ nullable: true })
  originalName: string; // الاسم الأصلي للملف

  @Column({ nullable: true })
  mimeType: string; // نوع الملف (image/jpeg, image/png)

  @Column({ nullable: true })
  size: number; // حجم الملف بالبايتات

  @Column({ nullable: true })
  folder: string; // المجلد في S3 (products, categories, etc.)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}