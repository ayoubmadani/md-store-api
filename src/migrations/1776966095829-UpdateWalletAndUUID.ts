import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateWalletAndUUID1776966095829 implements MigrationInterface {
    name = 'UpdateWalletAndUUID1776966095829'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "stores" DROP CONSTRAINT "FK_21cf9a9450ca5d9c5c174c034ba"`);
        await queryRunner.query(`ALTER TABLE "stores" DROP CONSTRAINT "UQ_21cf9a9450ca5d9c5c174c034ba"`);
        await queryRunner.query(`ALTER TABLE "stores" ADD CONSTRAINT "FK_21cf9a9450ca5d9c5c174c034ba" FOREIGN KEY ("themeId") REFERENCES "theme"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "stores" DROP CONSTRAINT "FK_21cf9a9450ca5d9c5c174c034ba"`);
        await queryRunner.query(`ALTER TABLE "stores" ADD CONSTRAINT "UQ_21cf9a9450ca5d9c5c174c034ba" UNIQUE ("themeId")`);
        await queryRunner.query(`ALTER TABLE "stores" ADD CONSTRAINT "FK_21cf9a9450ca5d9c5c174c034ba" FOREIGN KEY ("themeId") REFERENCES "theme"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

}
