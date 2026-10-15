import { MigrationInterface, QueryRunner } from 'typeorm';

// حفظ المنتج المجلوب من AliExpress: عند الإلغاء أو خطأ الحفظ يجده التاجر محفوظاً (ولا يُحسب جلبه مرة أخرى)
export class SavedAliexpressImports1794200000000 implements MigrationInterface {
  name = 'SavedAliexpressImports1794200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "aliexpress_imports" ADD COLUMN IF NOT EXISTS "language" varchar(5)`);
    await queryRunner.query(`ALTER TABLE "aliexpress_imports" ADD COLUMN IF NOT EXISTS "data" jsonb`);
    await queryRunner.query(`ALTER TABLE "aliexpress_imports" ADD COLUMN IF NOT EXISTS "productId" uuid`);
    await queryRunner.query(`ALTER TABLE "aliexpress_imports" ADD COLUMN IF NOT EXISTS "dismissedAt" TIMESTAMP`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const c of ['dismissedAt', 'productId', 'data', 'language']) {
      await queryRunner.query(`ALTER TABLE "aliexpress_imports" DROP COLUMN IF EXISTS "${c}"`);
    }
  }
}
