import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 1) حسابات الشحن: كل تاجر يملك حساباً افتراضياً تنتقل له أسعاره الحالية، ويمكنه إنشاء حسابات أخرى
 *    بأسعار وولايات مختلفة ثم اختيار حساب لكل متجر (stores.shippingProfileId، null = الافتراضي).
 * 2) إضافات المنتج (products.addons) ونسختها المختارة في عنصر الطلب (order_items.addons).
 */
export class AddShippingProfilesAndProductAddons1792700000000 implements MigrationInterface {
  name = 'AddShippingProfilesAndProductAddons1792700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "shipping_profiles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "name" character varying NOT NULL,
        "isDefault" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_shipping_profiles" PRIMARY KEY ("id"),
        CONSTRAINT "FK_shipping_profiles_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_shipping_profiles_default" ON "shipping_profiles" ("userId") WHERE "isDefault"`);

    // حساب افتراضي لكل تاجر عنده أسعار شحن، ثم ربط أسعاره الحالية به
    await queryRunner.query(`
      INSERT INTO "shipping_profiles" ("userId", "name", "isDefault")
      SELECT DISTINCT s."userId", 'الحساب الافتراضي', true FROM "shippings" s
      WHERE NOT EXISTS (SELECT 1 FROM "shipping_profiles" p WHERE p."userId" = s."userId" AND p."isDefault")`);
    await queryRunner.query(`ALTER TABLE "shippings" ADD COLUMN IF NOT EXISTS "profileId" uuid`);
    await queryRunner.query(`
      UPDATE "shippings" s SET "profileId" = p."id"
      FROM "shipping_profiles" p
      WHERE p."userId" = s."userId" AND p."isDefault" AND s."profileId" IS NULL`);
    await queryRunner.query(`ALTER TABLE "shippings" ALTER COLUMN "profileId" SET NOT NULL`);
    await queryRunner.query(`
      ALTER TABLE "shippings" ADD CONSTRAINT "FK_shippings_profile"
      FOREIGN KEY ("profileId") REFERENCES "shipping_profiles"("id") ON DELETE CASCADE`);

    // التفرّد أصبح لكل حساب وليس لكل تاجر
    await queryRunner.query(`ALTER TABLE "shippings" DROP CONSTRAINT IF EXISTS "UQ_7109b58f70387e75e0c475588cc"`);
    await queryRunner.query(`ALTER TABLE "shippings" ADD CONSTRAINT "UQ_shippings_profile_wilaya" UNIQUE ("profileId", "wilayaId")`);

    await queryRunner.query(`ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "shippingProfileId" uuid`);
    await queryRunner.query(`
      ALTER TABLE "stores" ADD CONSTRAINT "FK_stores_shipping_profile"
      FOREIGN KEY ("shippingProfileId") REFERENCES "shipping_profiles"("id") ON DELETE SET NULL`);

    await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "addons" jsonb NOT NULL DEFAULT '[]'`);
    await queryRunner.query(`ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "addons" jsonb`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "order_items" DROP COLUMN IF EXISTS "addons"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "addons"`);
    await queryRunner.query(`ALTER TABLE "stores" DROP CONSTRAINT IF EXISTS "FK_stores_shipping_profile"`);
    await queryRunner.query(`ALTER TABLE "stores" DROP COLUMN IF EXISTS "shippingProfileId"`);
    // لا يمكن الرجوع للتفرّد القديم إلا بعد حذف أسعار الحسابات غير الافتراضية
    await queryRunner.query(`
      DELETE FROM "shippings" s USING "shipping_profiles" p
      WHERE s."profileId" = p."id" AND NOT p."isDefault"`);
    await queryRunner.query(`ALTER TABLE "shippings" DROP CONSTRAINT IF EXISTS "UQ_shippings_profile_wilaya"`);
    await queryRunner.query(`ALTER TABLE "shippings" ADD CONSTRAINT "UQ_7109b58f70387e75e0c475588cc" UNIQUE ("userId", "wilayaId")`);
    await queryRunner.query(`ALTER TABLE "shippings" DROP CONSTRAINT IF EXISTS "FK_shippings_profile"`);
    await queryRunner.query(`ALTER TABLE "shippings" DROP COLUMN IF EXISTS "profileId"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "shipping_profiles"`);
  }
}
