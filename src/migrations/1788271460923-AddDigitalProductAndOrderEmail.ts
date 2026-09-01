import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDigitalProductAndOrderEmail1788271460923 implements MigrationInterface {
    name = 'AddDigitalProductAndOrderEmail1788271460923'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "products" ADD "isDigital" boolean NOT NULL DEFAULT false`);

        await queryRunner.query(`ALTER TABLE "orders" ADD "customerEmail" character varying`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "isDigital" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "customerWilayaId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "customerCommuneId" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "customerCommuneId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "customerWilayaId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "isDigital"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "customerEmail"`);

        await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "isDigital"`);
    }

}
