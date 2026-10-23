import { MigrationInterface, QueryRunner } from 'typeorm';

// رموز الدخول لمرة واحدة (لوحة التاجر ← تطبيق المخزون)
export class AuthHandoffs1795200000000 implements MigrationInterface {
  name = 'AuthHandoffs1795200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "auth_handoffs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "codeHash" varchar(64) NOT NULL,
        "userId" varchar(64) NOT NULL,
        "expiresAt" timestamptz NOT NULL,
        "usedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_auth_handoffs" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_auth_handoffs_code" UNIQUE ("codeHash")
      )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "auth_handoffs"`);
  }
}
