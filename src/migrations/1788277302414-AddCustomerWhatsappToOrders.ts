import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCustomerWhatsappToOrders1788277302414 implements MigrationInterface {
    name = 'AddCustomerWhatsappToOrders1788277302414'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "orders" ADD "customerWhatsapp" character varying`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "customerWhatsapp"`);
    }

}
