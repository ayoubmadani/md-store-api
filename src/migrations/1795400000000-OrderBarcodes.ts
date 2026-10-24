import { MigrationInterface, QueryRunner } from 'typeorm';

// باركود لكل طلب (O100001…): تسلسل في قاعدة البيانات — كل طلب جديد يأخذه تلقائياً أياً كان مصدره.
// الطلبات القديمة تأخذ أرقامها حسب تاريخها. + فهرس لرقم تتبع شركة التوصيل (المسح يبحث بالاثنين)
export class OrderBarcodes1795400000000 implements MigrationInterface {
  name = 'OrderBarcodes1795400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE SEQUENCE IF NOT EXISTS "order_barcode_seq" START 100001`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "barcode" varchar(32)`);
    // الأقدم يأخذ الرقم الأصغر، ثم يبدأ التسلسل بعد أكبر رقم
    await queryRunner.query(`
      WITH x AS (SELECT id, row_number() OVER (ORDER BY "createdAt", id) AS rn FROM "orders" WHERE "barcode" IS NULL)
      UPDATE "orders" o SET "barcode" = 'O' || (100000 + x.rn) FROM x WHERE o.id = x.id`);
    await queryRunner.query(`
      SELECT setval('order_barcode_seq', GREATEST(100000, COALESCE((SELECT MAX(substring("barcode" from 2)::bigint) FROM "orders" WHERE "barcode" ~ '^O[0-9]+$'), 100000)))`);
    await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "barcode" SET DEFAULT ('O' || nextval('order_barcode_seq'))`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_orders_barcode" ON "orders" ("barcode")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_orders_store_tracking" ON "orders" ("storeId", upper("shippingTrackingId")) WHERE "shippingTrackingId" IS NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_orders_store_tracking"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_orders_barcode"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "barcode"`);
    await queryRunner.query(`DROP SEQUENCE IF EXISTS "order_barcode_seq"`);
  }
}
