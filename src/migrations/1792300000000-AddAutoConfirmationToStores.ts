import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAutoConfirmationToStores1792300000000 implements MigrationInterface {
  name = 'AddAutoConfirmationToStores1792300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "autoConfirmationEnabled" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "autoConfirmationCompanyId" uuid`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "stores" DROP COLUMN IF EXISTS "autoConfirmationCompanyId"`);
    await queryRunner.query(`ALTER TABLE "stores" DROP COLUMN IF EXISTS "autoConfirmationEnabled"`);
  }
}
