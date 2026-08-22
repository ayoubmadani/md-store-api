import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFreeShippingToProductsAndOffers1787411084600 implements MigrationInterface {
    name = 'AddFreeShippingToProductsAndOffers1787411084600'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "products" ADD "shippingFree" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "product_offers" ADD "subTitle" character varying`);
        await queryRunner.query(`ALTER TABLE "product_offers" ADD "shippingFree" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "product_offers" DROP COLUMN "shippingFree"`);
        await queryRunner.query(`ALTER TABLE "product_offers" DROP COLUMN "subTitle"`);
        await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "shippingFree"`);
    }

}
