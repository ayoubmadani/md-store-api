import { MigrationInterface, QueryRunner } from 'typeorm';

// حد حسابات الشحن حسب الخطة (شاملاً الحساب الافتراضي)
export class ShippingProfileLimit1794800000000 implements MigrationInterface {
  name = 'ShippingProfileLimit1794800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plan_features" ADD COLUMN IF NOT EXISTS "shippingProfileNumber" integer NOT NULL DEFAULT 3`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plan_features" DROP COLUMN IF EXISTS "shippingProfileNumber"`);
  }
}
