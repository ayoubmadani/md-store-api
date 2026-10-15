import { MigrationInterface, QueryRunner } from 'typeorm';

// ربط AliExpress وإلغاؤه من لوحة الأدمن فقط: حساب واحد للمنصة (isPlatform) بلا مستخدم
export class AliexpressPlatformAccount1794300000000 implements MigrationInterface {
  name = 'AliexpressPlatformAccount1794300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "aliexpress_accounts" ALTER COLUMN "userId" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "aliexpress_accounts" ADD COLUMN IF NOT EXISTS "isPlatform" boolean NOT NULL DEFAULT false`);
    // الحساب الحالي (المربوط من حساب ADMIN) يصبح حساب المنصة
    await queryRunner.query(`
      UPDATE "aliexpress_accounts" a SET "isPlatform" = true
        FROM "users" u WHERE u.id = a."userId" AND u.role = 'ADMIN'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "aliexpress_accounts" WHERE "userId" IS NULL`);
    await queryRunner.query(`ALTER TABLE "aliexpress_accounts" DROP COLUMN IF EXISTS "isPlatform"`);
    await queryRunner.query(`ALTER TABLE "aliexpress_accounts" ALTER COLUMN "userId" SET NOT NULL`);
  }
}
