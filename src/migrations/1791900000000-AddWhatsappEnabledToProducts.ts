import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWhatsappEnabledToProducts1791900000000 implements MigrationInterface {
  name = 'AddWhatsappEnabledToProducts1791900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "whatsappEnabled" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "whatsappNumber" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "whatsappNumber"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "whatsappEnabled"`);
  }
}
