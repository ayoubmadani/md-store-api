import { MigrationInterface, QueryRunner } from 'typeorm';

// نوع التوصيل المتاح لكل ولاية (منزل / مكتب) — الاثنان مفعّلان للأسعار الحالية
export class AddDeliveryTypesToShippings1793100000000 implements MigrationInterface {
  name = 'AddDeliveryTypesToShippings1793100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "shippings" ADD COLUMN IF NOT EXISTS "homeEnabled" boolean NOT NULL DEFAULT true`);
    await queryRunner.query(`ALTER TABLE "shippings" ADD COLUMN IF NOT EXISTS "officeEnabled" boolean NOT NULL DEFAULT true`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "shippings" DROP COLUMN IF EXISTS "officeEnabled"`);
    await queryRunner.query(`ALTER TABLE "shippings" DROP COLUMN IF EXISTS "homeEnabled"`);
  }
}
