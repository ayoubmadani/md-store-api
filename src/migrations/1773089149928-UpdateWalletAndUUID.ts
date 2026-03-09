import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateWalletAndUUID1773089149928 implements MigrationInterface {
    name = 'UpdateWalletAndUUID1773089149928'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "niches" ADD "slug" character varying NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "niches" DROP COLUMN "slug"`);
    }

}
