import { MigrationInterface, QueryRunner } from "typeorm";

export class AddNameAndScopeToStorePixels1788202228371 implements MigrationInterface {
    name = 'AddNameAndScopeToStorePixels1788202228371'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "store_pixels" ADD "name" character varying(100)`);

        await queryRunner.query(`CREATE TYPE "public"."store_pixels_scope_enum" AS ENUM('store', 'landing_page', 'both')`);
        await queryRunner.query(`ALTER TABLE "store_pixels" ADD "scope" "public"."store_pixels_scope_enum" NOT NULL DEFAULT 'store'`);
        // البكسلات الموجودة حالياً تعمل فعلياً في كل مكان (لا يوجد أي تصفية
        // قبل هذه الهجرة) — نُبقيها على 'both' بدل الافتراضي 'store' حتى لا
        // تتوقف فجأة عن العمل في صفحات الهبوط بعد إضافة منطق التصفية الجديد
        await queryRunner.query(`UPDATE "store_pixels" SET "scope" = 'both'`);

        await queryRunner.query(`ALTER TABLE "store_pixels" ADD "landingPageId" uuid`);
        await queryRunner.query(`ALTER TABLE "store_pixels" ADD CONSTRAINT "FK_store_pixels_landingPageId" FOREIGN KEY ("landingPageId") REFERENCES "landing-pages"("id") ON DELETE SET NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "store_pixels" DROP CONSTRAINT "FK_store_pixels_landingPageId"`);
        await queryRunner.query(`ALTER TABLE "store_pixels" DROP COLUMN "landingPageId"`);
        await queryRunner.query(`ALTER TABLE "store_pixels" DROP COLUMN "scope"`);
        await queryRunner.query(`DROP TYPE "public"."store_pixels_scope_enum"`);
        await queryRunner.query(`ALTER TABLE "store_pixels" DROP COLUMN "name"`);
    }

}
