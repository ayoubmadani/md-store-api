import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSplitTests1793400000000 implements MigrationInterface {
  name = 'CreateSplitTests1793400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "split_tests" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "storeId" uuid NOT NULL,
        "name" character varying(120) NOT NULL,
        "domain" character varying NOT NULL,
        "variants" jsonb NOT NULL DEFAULT '[]',
        "isActive" boolean NOT NULL DEFAULT true,
        "winnerPageId" uuid,
        "endedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_split_tests_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_split_tests_domain" UNIQUE ("domain"),
        CONSTRAINT "FK_split_tests_store" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE
      )
    `);
    // من أي اختبار جاءت الزيارة/الطلب (الصفحة نفسها في builderPageId)
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "splitTestId" uuid`);
    await queryRunner.query(`ALTER TABLE "shows" ADD COLUMN IF NOT EXISTS "splitTestId" uuid`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_orders_splitTestId" ON "orders" ("splitTestId") WHERE "splitTestId" IS NOT NULL`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_shows_splitTestId" ON "shows" ("splitTestId") WHERE "splitTestId" IS NOT NULL`);
    // دومين مخصص لاختبار (بدل صفحة واحدة)
    await queryRunner.query(`ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "splitTestId" uuid`);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "domains" ADD CONSTRAINT "FK_domains_split_test" FOREIGN KEY ("splitTestId") REFERENCES "split_tests"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "domains" DROP CONSTRAINT IF EXISTS "FK_domains_split_test"`);
    await queryRunner.query(`ALTER TABLE "domains" DROP COLUMN IF EXISTS "splitTestId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_shows_splitTestId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_orders_splitTestId"`);
    await queryRunner.query(`ALTER TABLE "shows" DROP COLUMN IF EXISTS "splitTestId"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN IF EXISTS "splitTestId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "split_tests"`);
  }
}
