import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCompanyPauseAndBlockedMerchants1792500000000 implements MigrationInterface {
  name = 'AddCompanyPauseAndBlockedMerchants1792500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "confirmation_companies" ADD COLUMN IF NOT EXISTS "isPaused" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`ALTER TABLE "confirmation_companies" ADD COLUMN IF NOT EXISTS "pausedUntil" TIMESTAMP WITH TIME ZONE`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "confirmation_blocked_merchants" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "companyId" uuid NOT NULL,
        "merchantId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_confirmation_blocked_merchants" UNIQUE ("companyId", "merchantId"),
        CONSTRAINT "PK_confirmation_blocked_merchants" PRIMARY KEY ("id"),
        CONSTRAINT "FK_blocked_company" FOREIGN KEY ("companyId") REFERENCES "confirmation_companies"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_blocked_merchant" FOREIGN KEY ("merchantId") REFERENCES "users"("id") ON DELETE CASCADE
      )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "confirmation_blocked_merchants"`);
    await queryRunner.query(`ALTER TABLE "confirmation_companies" DROP COLUMN IF EXISTS "pausedUntil"`);
    await queryRunner.query(`ALTER TABLE "confirmation_companies" DROP COLUMN IF EXISTS "isPaused"`);
  }
}
