import { MigrationInterface, QueryRunner } from 'typeorm';

// شحن المحفظة بـ USDT عبر Binance: طلبات بمبلغ فريد تُؤكَّد برقم المعاملة
export class CryptoTopups1795000000000 implements MigrationInterface {
  name = 'CryptoTopups1795000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "crypto_topups" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" varchar(64) NOT NULL,
        "amountDzd" numeric(12,2) NOT NULL,
        "amountUsdt" numeric(14,4) NOT NULL,
        "rate" numeric(10,2) NOT NULL,
        "status" varchar(10) NOT NULL DEFAULT 'pending',
        "txId" varchar(128),
        "network" varchar(10),
        "expiresAt" timestamptz NOT NULL,
        "paidAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_crypto_topups" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_crypto_topups_txId" UNIQUE ("txId")
      )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_crypto_topups_status_created" ON "crypto_topups" ("status", "createdAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "crypto_topups"`);
  }
}
