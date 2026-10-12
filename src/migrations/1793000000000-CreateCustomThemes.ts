import { MigrationInterface, QueryRunner } from 'typeorm';

// ثيمات خاصة يصنعها Claude للتجار (طلب + مهام) وأنواع معاملات المحفظة الخاصة بها
export class CreateCustomThemes1793000000000 implements MigrationInterface {
  name = 'CreateCustomThemes1793000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "custom_theme_orders" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "storeId" uuid NOT NULL,
        "themeId" uuid,
        "slug" character varying(120) NOT NULL,
        "pricePaid" numeric(10,2) NOT NULL DEFAULT 0,
        "revisionsTotal" integer NOT NULL DEFAULT 0,
        "revisionsUsed" integer NOT NULL DEFAULT 0,
        "liveCode" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_custom_theme_orders" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_custom_theme_orders_slug" UNIQUE ("slug"),
        CONSTRAINT "FK_custom_theme_orders_store" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_custom_theme_orders_theme" FOREIGN KEY ("themeId") REFERENCES "theme"("id") ON DELETE SET NULL
      )`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "custom_theme_jobs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "orderId" uuid NOT NULL,
        "kind" character varying(20) NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'queued',
        "request" text NOT NULL,
        "batchId" character varying(100),
        "attempts" integer NOT NULL DEFAULT 0,
        "code" text,
        "bundle" text,
        "error" text,
        "charged" numeric(10,2) NOT NULL DEFAULT 0,
        "usedFreeRevision" boolean NOT NULL DEFAULT false,
        "readyAt" TIMESTAMP,
        "liveAt" TIMESTAMP,
        "lastCheckedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_custom_theme_jobs" PRIMARY KEY ("id"),
        CONSTRAINT "FK_custom_theme_jobs_order" FOREIGN KEY ("orderId") REFERENCES "custom_theme_orders"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_custom_theme_jobs_status" ON "custom_theme_jobs" ("status")`);
    // قيم جديدة في نوع المعاملة (enum في Postgres)
    await queryRunner.query(`ALTER TYPE "public"."transactions_type_enum" ADD VALUE IF NOT EXISTS 'custom_theme'`);
    await queryRunner.query(`ALTER TYPE "public"."transactions_type_enum" ADD VALUE IF NOT EXISTS 'custom_theme_revisions'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "custom_theme_jobs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "custom_theme_orders"`);
  }
}
