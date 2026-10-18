import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// صفحة صور واحدة محتسبة من الحد الشهري للتاجر
@Entity({ name: 'image_page_generations' })
@Index(['userId', 'createdAt'])
export class ImagePageGeneration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'uuid' })
  storeId: string;

  @Column({ type: 'uuid' })
  builderPageId: string;

  @Column({ type: 'varchar', length: 2 })
  language: string;

  @Column({ type: 'varchar', length: 20 })
  style: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
