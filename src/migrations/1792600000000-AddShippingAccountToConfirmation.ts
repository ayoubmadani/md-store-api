import { MigrationInterface, QueryRunner } from 'typeorm';

// حساب التوصيل لكل شركة تأكيد محفوظة، والحساب الذي رُفع به كل طلب
export class AddShippingAccountToConfirmation1792600000000 implements MigrationInterface {
  name = 'AddShippingAccountToConfirmation1792600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "store_confirmation_companies" ADD COLUMN IF NOT EXISTS "shippingAccountId" uuid`);
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "shippingAccountId" uuid`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "shippingAccountId"`);
    await queryRunner.query(`ALTER TABLE "store_confirmation_companies" DROP COLUMN IF EXISTS "shippingAccountId"`);
  }
}
