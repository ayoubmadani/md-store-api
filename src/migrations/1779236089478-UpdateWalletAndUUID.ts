import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateWalletAndUUID1779236089478 implements MigrationInterface {
    name = 'UpdateWalletAndUUID1779236089478'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "categories" ALTER COLUMN "mpath" DROP DEFAULT`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "categories" ALTER COLUMN "mpath" SET DEFAULT ''`);
    }

}
