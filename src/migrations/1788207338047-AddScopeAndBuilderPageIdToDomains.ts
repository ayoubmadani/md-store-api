import { MigrationInterface, QueryRunner } from "typeorm";

export class AddScopeAndBuilderPageIdToDomains1788207338047 implements MigrationInterface {
    name = 'AddScopeAndBuilderPageIdToDomains1788207338047'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."domains_scope_enum" AS ENUM('store', 'landing_page')`);
        await queryRunner.query(`ALTER TABLE "domains" ADD "scope" "public"."domains_scope_enum" NOT NULL DEFAULT 'store'`);

        await queryRunner.query(`ALTER TABLE "domains" ADD "builderPageId" uuid`);
        await queryRunner.query(`ALTER TABLE "domains" ADD CONSTRAINT "FK_domains_builderPageId" FOREIGN KEY ("builderPageId") REFERENCES "builder_pages"("id") ON DELETE SET NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "domains" DROP CONSTRAINT "FK_domains_builderPageId"`);
        await queryRunner.query(`ALTER TABLE "domains" DROP COLUMN "builderPageId"`);

        await queryRunner.query(`ALTER TABLE "domains" DROP COLUMN "scope"`);
        await queryRunner.query(`DROP TYPE "public"."domains_scope_enum"`);
    }

}
