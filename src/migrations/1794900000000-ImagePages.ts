import { MigrationInterface, QueryRunner } from 'typeorm';

// صفحات الصور بالذكاء الاصطناعي: الحد الشهري في الخطة + سجل الصفحات المحتسبة
export class ImagePages1794900000000 implements MigrationInterface {
  name = 'ImagePages1794900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plan_features" ADD COLUMN IF NOT EXISTS "imagePagesPerMonth" integer NOT NULL DEFAULT 0`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "image_page_generations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "storeId" uuid NOT NULL,
        "builderPageId" uuid NOT NULL,
        "language" varchar(2) NOT NULL,
        "style" varchar(20) NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_image_page_generations" PRIMARY KEY ("id")
      )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_image_page_generations_user_created" ON "image_page_generations" ("userId", "createdAt")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "image_page_generations"`);
    await queryRunner.query(`ALTER TABLE "plan_features" DROP COLUMN IF EXISTS "imagePagesPerMonth"`);
  }
}
