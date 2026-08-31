import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTotalImagesNumberToPlanFeatures1788199747343 implements MigrationInterface {
    name = 'AddTotalImagesNumberToPlanFeatures1788199747343'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "plan_features" ADD "totalImagesNumber" integer NOT NULL DEFAULT 4`);
        // نُهيّئ القيمة الابتدائية لكل خطة حالية بنفس الحد الفعلي المطبَّق
        // اليوم (productNumber × productImagesNumber)، حتى لا يتغير أي سلوك
        // فوراً بعد الترحيل — الحقل بعدها مستقل ويعدّله الأدمن يدوياً
        await queryRunner.query(`
            UPDATE "plan_features"
            SET "totalImagesNumber" = GREATEST("productNumber" * "productImagesNumber", 1)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "plan_features" DROP COLUMN "totalImagesNumber"`);
    }

}
