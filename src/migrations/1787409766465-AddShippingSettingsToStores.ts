import { MigrationInterface, QueryRunner } from "typeorm";

export class AddShippingSettingsToStores1787409766465 implements MigrationInterface {
    name = 'AddShippingSettingsToStores1787409766465'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "stores" ADD "supportQty" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "stores" ADD "supportFreeShipping" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "stores" ADD "freeShippingMinAmount" numeric(10,2)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "stores" DROP COLUMN "freeShippingMinAmount"`);
        await queryRunner.query(`ALTER TABLE "stores" DROP COLUMN "supportFreeShipping"`);
        await queryRunner.query(`ALTER TABLE "stores" DROP COLUMN "supportQty"`);
    }

}
