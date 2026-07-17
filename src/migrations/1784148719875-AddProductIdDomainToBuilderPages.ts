import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProductIdDomainToBuilderPages1784148719875 implements MigrationInterface {
    name = 'AddProductIdDomainToBuilderPages1784148719875'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "builder_pages" ADD "productId" character varying`);
        await queryRunner.query(`ALTER TABLE "builder_pages" ADD "domain" character varying`);
        await queryRunner.query(`ALTER TABLE "builder_pages" ADD CONSTRAINT "UQ_builder_pages_domain" UNIQUE ("domain")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "builder_pages" DROP CONSTRAINT "UQ_builder_pages_domain"`);
        await queryRunner.query(`ALTER TABLE "builder_pages" DROP COLUMN "domain"`);
        await queryRunner.query(`ALTER TABLE "builder_pages" DROP COLUMN "productId"`);
    }

}
