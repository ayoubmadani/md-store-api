import { MigrationInterface, QueryRunner } from 'typeorm';

// دولة حساب الشحن (ISO alpha-2) — كل الحسابات الحالية جزائرية
export class ShippingProfileCountry1794500000000 implements MigrationInterface {
  name = 'ShippingProfileCountry1794500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "shipping_profiles" ADD COLUMN IF NOT EXISTS "country" varchar(2) NOT NULL DEFAULT 'DZ'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "shipping_profiles" DROP COLUMN IF EXISTS "country"`);
  }
}
