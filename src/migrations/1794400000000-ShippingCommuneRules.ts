import { MigrationInterface, QueryRunner } from 'typeorm';

// تعطيل بلديات داخل حساب شحن (كلياً أو للمنزل/المكتب فقط) — نخزّن الاستثناءات فقط
export class ShippingCommuneRules1794400000000 implements MigrationInterface {
  name = 'ShippingCommuneRules1794400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "shipping_commune_rules" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "profileId" uuid NOT NULL,
        "communeId" integer NOT NULL,
        "wilayaId" integer NOT NULL,
        "homeEnabled" boolean NOT NULL DEFAULT false,
        "officeEnabled" boolean NOT NULL DEFAULT false,
        CONSTRAINT "PK_shipping_commune_rules" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_shipping_commune_rules_profile_commune" UNIQUE ("profileId", "communeId"),
        CONSTRAINT "FK_shipping_commune_rules_profile" FOREIGN KEY ("profileId") REFERENCES "shipping_profiles"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_shipping_commune_rules_commune" FOREIGN KEY ("communeId") REFERENCES "communes"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_shipping_commune_rules_profile_wilaya" ON "shipping_commune_rules" ("profileId", "wilayaId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "shipping_commune_rules"`);
  }
}
