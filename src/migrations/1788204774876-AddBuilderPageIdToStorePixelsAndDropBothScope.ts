import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBuilderPageIdToStorePixelsAndDropBothScope1788204774876 implements MigrationInterface {
    name = 'AddBuilderPageIdToStorePixelsAndDropBothScope1788204774876'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "store_pixels" ADD "builderPageId" uuid`);
        await queryRunner.query(`ALTER TABLE "store_pixels" ADD CONSTRAINT "FK_store_pixels_builderPageId" FOREIGN KEY ("builderPageId") REFERENCES "builder_pages"("id") ON DELETE SET NULL`);

        // 'both' لم يعد خياراً مدعوماً — النطاق الآن ثنائي (store/landing_page)
        // فقط، ويُحدَّد تلقائياً حسب مكان إنشاء البكسل (صفحة البكسلات أو داخل
        // المحرر). الصفوف الموجودة حالياً بـ scope='both' تتحول إلى 'store'
        // (قرار المستخدم) — تستمر بالعمل على المتجر، ولن تُطبَّق تلقائياً على
        // أي صفحة هبوط حتى تُربط يدوياً من داخل المحرر.
        await queryRunner.query(`UPDATE "store_pixels" SET "scope" = 'store' WHERE "scope" = 'both'`);

        await queryRunner.query(`ALTER TYPE "public"."store_pixels_scope_enum" RENAME TO "store_pixels_scope_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."store_pixels_scope_enum" AS ENUM('store', 'landing_page')`);
        await queryRunner.query(`ALTER TABLE "store_pixels" ALTER COLUMN "scope" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "store_pixels" ALTER COLUMN "scope" TYPE "public"."store_pixels_scope_enum" USING "scope"::"text"::"public"."store_pixels_scope_enum"`);
        await queryRunner.query(`ALTER TABLE "store_pixels" ALTER COLUMN "scope" SET DEFAULT 'store'`);
        await queryRunner.query(`DROP TYPE "public"."store_pixels_scope_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."store_pixels_scope_enum" RENAME TO "store_pixels_scope_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."store_pixels_scope_enum" AS ENUM('store', 'landing_page', 'both')`);
        await queryRunner.query(`ALTER TABLE "store_pixels" ALTER COLUMN "scope" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "store_pixels" ALTER COLUMN "scope" TYPE "public"."store_pixels_scope_enum" USING "scope"::"text"::"public"."store_pixels_scope_enum"`);
        await queryRunner.query(`ALTER TABLE "store_pixels" ALTER COLUMN "scope" SET DEFAULT 'store'`);
        await queryRunner.query(`DROP TYPE "public"."store_pixels_scope_enum_old"`);

        await queryRunner.query(`ALTER TABLE "store_pixels" DROP CONSTRAINT "FK_store_pixels_builderPageId"`);
        await queryRunner.query(`ALTER TABLE "store_pixels" DROP COLUMN "builderPageId"`);
    }

}
