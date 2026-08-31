import { MigrationInterface, QueryRunner } from "typeorm";

export class LowerDefaultProductImagesNumber1788191257564 implements MigrationInterface {
    name = 'LowerDefaultProductImagesNumber1788191257564'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "plan_features" ALTER COLUMN "productImagesNumber" SET DEFAULT 1`);
        // فقط الصفوف التي لا تزال على القيمة الافتراضية المؤقتة (20) التي وُضعت
        // بالخطأ قبل قليل — لا نلمس أي قيمة عدّلها أحد يدوياً بين الهجرتين
        await queryRunner.query(`UPDATE "plan_features" SET "productImagesNumber" = 1 WHERE "productImagesNumber" = 20`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "plan_features" ALTER COLUMN "productImagesNumber" SET DEFAULT 20`);
        await queryRunner.query(`UPDATE "plan_features" SET "productImagesNumber" = 20 WHERE "productImagesNumber" = 1`);
    }

}
