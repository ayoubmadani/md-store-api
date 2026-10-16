import { MigrationInterface, QueryRunner } from 'typeorm';

// دولة المتجر — كل المتاجر الحالية جزائرية؛ حساب الشحن يجب أن يكون من نفس الدولة
export class StoreCountry1794700000000 implements MigrationInterface {
  name = 'StoreCountry1794700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "country" varchar(2) NOT NULL DEFAULT 'DZ'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "stores" DROP COLUMN IF EXISTS "country"`);
  }
}
