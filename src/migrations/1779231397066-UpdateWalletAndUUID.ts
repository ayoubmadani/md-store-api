import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateWalletAndUUID1779231397066 implements MigrationInterface {
    name = 'UpdateWalletAndUUID1779231397066'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "store_contacts" DROP COLUMN "address"`);
        await queryRunner.query(`ALTER TABLE "store_contacts" ADD "address" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "store_contacts" DROP COLUMN "address"`);
        await queryRunner.query(`ALTER TABLE "store_contacts" ADD "address" character varying(255)`);
    }

}
