import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateWalletAndUUID1776099282463 implements MigrationInterface {
    name = 'UpdateWalletAndUUID1776099282463'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "orders" RENAME COLUMN "totalCartPrice" TO "totalPrice"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "orders" RENAME COLUMN "totalPrice" TO "totalCartPrice"`);
    }

}
