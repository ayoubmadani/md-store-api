import { MigrationInterface, QueryRunner } from "typeorm";

export class DropProductImageColumn1788188054190 implements MigrationInterface {
    name = 'DropProductImageColumn1788188054190'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "productImage"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "products" ADD "productImage" character varying`);
    }

}
