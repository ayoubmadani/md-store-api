import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// طلب شحن محفظة بـ USDT عبر Binance: مبلغ USDT فريد لكل طلب يربط الإيداع بصاحبه
// (معاملات البلوكتشين عامة — بدون المبلغ الفريد يستطيع أي أحد نسخ TxID غيره)
@Entity({ name: 'crypto_topups' })
@Index(['status', 'createdAt'])
export class CryptoTopup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64 })
  userId: string;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amountDzd: string;

  @Column({ type: 'numeric', precision: 14, scale: 4 })
  amountUsdt: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  rate: string;

  @Column({ type: 'varchar', length: 10, default: 'pending' })
  status: 'pending' | 'paid';

  @Column({ type: 'varchar', length: 128, nullable: true, unique: true })
  txId: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  network: string | null;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
