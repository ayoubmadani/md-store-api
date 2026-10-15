import { MigrationInterface, QueryRunner } from 'typeorm';

// حد يومي لجلب المنتجات من AliExpress (حسب الخطة) + سجل عمليات الجلب لعدّها
export class AliexpressDailyLimit1794100000000 implements MigrationInterface {
  name = 'AliexpressDailyLimit1794100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plan_features" ADD COLUMN IF NOT EXISTS "aliexpressImportsPerDay" integer NOT NULL DEFAULT 10`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "aliexpress_imports" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        "userId" uuid NOT NULL,
        "actorId" uuid,
        "aliexpressProductId" varchar(40) NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_aliexpress_imports_user_date" ON "aliexpress_imports" ("userId", "createdAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "aliexpress_imports"`);
    await queryRunner.query(`ALTER TABLE "plan_features" DROP COLUMN IF EXISTS "aliexpressImportsPerDay"`);
  }
}
