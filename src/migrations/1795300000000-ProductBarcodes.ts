import { MigrationInterface, QueryRunner } from 'typeorm';

// باركود للمنتج وللنسخة (فريد داخل المتجر — يُتحقق في الخدمة) + فهارس للبحث بالمسح
export class ProductBarcodes1795300000000 implements MigrationInterface {
  name = 'ProductBarcodes1795300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "barcode" varchar(64)`);
    await queryRunner.query(`ALTER TABLE "variant_details" ADD COLUMN IF NOT EXISTS "barcode" varchar(64)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_products_store_barcode" ON "products" ("storeId", "barcode") WHERE "barcode" IS NOT NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_variant_details_barcode" ON "variant_details" ("barcode") WHERE "barcode" IS NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_variant_details_barcode"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_products_store_barcode"`);
    await queryRunner.query(`ALTER TABLE "variant_details" DROP COLUMN IF EXISTS "barcode"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "barcode"`);
  }
}
