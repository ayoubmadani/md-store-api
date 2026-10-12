import { MigrationInterface, QueryRunner } from 'typeorm';

// إعدادات المنصة (مفتاح ← قيمة) — أولها رسوم التأكيد: 12 د.ج على الشركة عن كل طلب مؤكد
export class CreatePlatformSettings1792400000000 implements MigrationInterface {
  name = 'CreatePlatformSettings1792400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "platform_settings" (
        "key" character varying(100) NOT NULL,
        "value" jsonb NOT NULL,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_platform_settings" PRIMARY KEY ("key")
      )`);
    await queryRunner.query(
      `INSERT INTO "platform_settings" ("key", "value") VALUES ('confirmationFee', '12') ON CONFLICT ("key") DO NOTHING`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "platform_settings"`);
  }
}
