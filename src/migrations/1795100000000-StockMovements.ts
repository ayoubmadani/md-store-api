import { MigrationInterface, QueryRunner } from 'typeorm';

// تتبع المخزون: سجل الحركات + حد التنبيه وسعر الشراء للمنتج
export class StockMovements1795100000000 implements MigrationInterface {
  name = 'StockMovements1795100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stock_movements" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "storeId" varchar(64) NOT NULL,
        "productId" varchar(64) NOT NULL,
        "variantDetailId" varchar(64),
        "delta" integer NOT NULL,
        "stockAfter" integer NOT NULL,
        "reason" varchar(20) NOT NULL,
        "orderId" varchar(64),
        "note" varchar(255),
        "userId" varchar(64),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_stock_movements" PRIMARY KEY ("id")
      )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_stock_movements_store_created" ON "stock_movements" ("storeId", "createdAt")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_stock_movements_order" ON "stock_movements" ("orderId")`);
    await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "lowStockThreshold" integer NOT NULL DEFAULT 5`);
    await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "costPrice" numeric(12,2)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "costPrice"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "lowStockThreshold"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stock_movements"`);
  }
}
