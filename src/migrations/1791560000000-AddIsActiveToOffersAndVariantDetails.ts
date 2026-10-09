import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIsActiveToOffersAndVariantDetails1791560000000 implements MigrationInterface {
    name = 'AddIsActiveToOffersAndVariantDetails1791560000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "product_offers" ADD "isActive" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "variant_details" ADD "isActive" boolean NOT NULL DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "variant_details" DROP COLUMN "isActive"`);
        await queryRunner.query(`ALTER TABLE "product_offers" DROP COLUMN "isActive"`);
    }

}
