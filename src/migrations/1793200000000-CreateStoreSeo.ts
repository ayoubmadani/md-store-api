import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateStoreSeo1793200000000 implements MigrationInterface {
  name = 'CreateStoreSeo1793200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "store_seo" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "storeId" uuid NOT NULL,
        "metaTitle" character varying(70),
        "metaDescription" character varying(170),
        "keywords" character varying(300),
        "ogImageUrl" character varying(500),
        "googleVerification" character varying(120),
        "bingVerification" character varying(120),
        "allowIndexing" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_store_seo_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_store_seo_storeId" UNIQUE ("storeId"),
        CONSTRAINT "FK_store_seo_store" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "store_seo"`);
  }
}
