import { MigrationInterface, QueryRunner } from 'typeorm';

// مدير المنصة في جدول منفصل عن users — أول مدير هو صاحب المنصة
export class CreateSuperAdmins1792200000000 implements MigrationInterface {
  name = 'CreateSuperAdmins1792200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "super_admins" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying NOT NULL,
        "name" character varying,
        "pinAttempts" integer NOT NULL DEFAULT 0,
        "pinLockedUntil" TIMESTAMP,
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_super_admins_email" UNIQUE ("email"),
        CONSTRAINT "PK_super_admins" PRIMARY KEY ("id")
      )`);
    await queryRunner.query(
      `INSERT INTO "super_admins" ("email", "name") VALUES ($1, $2) ON CONFLICT ("email") DO NOTHING`,
      ['ayoubbansalah123456@gmail.com', 'ayoub'],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "super_admins"`);
  }
}
