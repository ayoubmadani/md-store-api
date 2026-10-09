import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAliexpressAccounts1792000000000 implements MigrationInterface {
  name = 'CreateAliexpressAccounts1792000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "aliexpress_accounts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "accessToken" text NOT NULL,
        "refreshToken" text,
        "expiresAt" TIMESTAMP,
        "refreshExpiresAt" TIMESTAMP,
        "account" character varying,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_aliexpress_accounts_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_aliexpress_accounts_userId" UNIQUE ("userId"),
        CONSTRAINT "FK_aliexpress_accounts_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "aliexpress_accounts"`);
  }
}
