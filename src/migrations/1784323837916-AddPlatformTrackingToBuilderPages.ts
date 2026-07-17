import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPlatformTrackingToBuilderPages1784323837916 implements MigrationInterface {
    name = 'AddPlatformTrackingToBuilderPages1784323837916'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "builder_pages" ADD "platform" character varying NOT NULL DEFAULT 'md store'`);
        await queryRunner.query(`ALTER TABLE "builder_pages" ADD "isActive" boolean NOT NULL DEFAULT true`);
        // uuid, not character varying — must match builder_pages.id's real
        // column type (a uuid PrimaryGeneratedColumn) for the FK below to be
        // addable at all; lpId on these same two tables is uuid for the
        // same reason.
        await queryRunner.query(`ALTER TABLE "shows" ADD "builderPageId" uuid`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "builderPageId" uuid`);
        await queryRunner.query(`ALTER TABLE "shows" ADD CONSTRAINT "FK_shows_builderPageId" FOREIGN KEY ("builderPageId") REFERENCES "builder_pages"("id") ON DELETE CASCADE`);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_orders_builderPageId" FOREIGN KEY ("builderPageId") REFERENCES "builder_pages"("id") ON DELETE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_orders_builderPageId"`);
        await queryRunner.query(`ALTER TABLE "shows" DROP CONSTRAINT "FK_shows_builderPageId"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "builderPageId"`);
        await queryRunner.query(`ALTER TABLE "shows" DROP COLUMN "builderPageId"`);
        await queryRunner.query(`ALTER TABLE "builder_pages" DROP COLUMN "isActive"`);
        await queryRunner.query(`ALTER TABLE "builder_pages" DROP COLUMN "platform"`);
    }

}
