import { MigrationInterface, QueryRunner } from 'typeorm';

// مفاتيح MCP لمدير المنصة (mdsa_) + تتبّع آخر تحدّي PIN مستعمل (كل تحدٍّ مرة واحدة)
export class AddSuperAdminApiKeys1792900000000 implements MigrationInterface {
  name = 'AddSuperAdminApiKeys1792900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "super_admin_api_keys" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "superAdminId" uuid NOT NULL,
        "name" character varying(100) NOT NULL,
        "keyHash" character varying(64) NOT NULL,
        "prefix" character varying(9) NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "revokedAt" TIMESTAMP,
        "lastUsedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_super_admin_api_keys" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_super_admin_api_keys_hash" UNIQUE ("keyHash"),
        CONSTRAINT "FK_super_admin_api_keys_admin" FOREIGN KEY ("superAdminId") REFERENCES "super_admins"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(`ALTER TABLE "super_admins" ADD COLUMN IF NOT EXISTS "lastMcpChallengeTs" bigint`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "super_admins" DROP COLUMN IF EXISTS "lastMcpChallengeTs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "super_admin_api_keys"`);
  }
}
