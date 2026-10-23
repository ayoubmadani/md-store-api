import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type StockReason = 'order' | 'manual' | 'restock';

// سجل حركات المخزون: كل دخول وخروج، مع سببه والمخزون بعده
@Entity({ name: 'stock_movements' })
@Index(['storeId', 'createdAt'])
@Index(['orderId'])
export class StockMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64 })
  storeId: string;

  @Column({ type: 'varchar', length: 64 })
  productId: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  variantDetailId: string | null;

  // + دخول / − خروج
  @Column({ type: 'int' })
  delta: number;

  @Column({ type: 'int' })
  stockAfter: number;

  // order = حجز/إرجاع من طلب، manual = تعديل يدوي، restock = توريد
  @Column({ type: 'varchar', length: 20 })
  reason: StockReason;

  @Column({ type: 'varchar', length: 64, nullable: true })
  orderId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  userId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
