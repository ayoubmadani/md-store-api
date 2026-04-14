import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateWalletAndUUID1776178187516 implements MigrationInterface {
    name = 'UpdateWalletAndUUID1776178187516'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "product_variants" DROP CONSTRAINT "FK_b41dfbf95f156aae9fdca612917"`);
        await queryRunner.query(`ALTER TABLE "product_variants" DROP COLUMN "ordersId"`);
        await queryRunner.query(`ALTER TABLE "stores" ADD "cart" boolean NOT NULL DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "stores" DROP COLUMN "cart"`);
        await queryRunner.query(`ALTER TABLE "product_variants" ADD "ordersId" uuid`);
        await queryRunner.query(`ALTER TABLE "product_variants" ADD CONSTRAINT "FK_b41dfbf95f156aae9fdca612917" FOREIGN KEY ("ordersId") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
