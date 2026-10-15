import { MigrationInterface, QueryRunner } from 'typeorm';

// آخر متجر اختاره المستخدم في اللوحة — يبقى بعد تسجيل الخروج والدخول ومن أي جهاز
export class AddUserLastStore1793700000000 implements MigrationInterface {
  name = 'AddUserLastStore1793700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastStoreId" uuid`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "lastStoreId"`);
  }
}
