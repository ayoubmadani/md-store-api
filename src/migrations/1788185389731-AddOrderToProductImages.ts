import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOrderToProductImages1788185389731 implements MigrationInterface {
    name = 'AddOrderToProductImages1788185389731'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "product-images" ADD "order" integer NOT NULL DEFAULT 0`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "product-images" DROP COLUMN "order"`);
    }

}
