import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSettingsToBuilderPages1784308210102 implements MigrationInterface {
    name = 'AddSettingsToBuilderPages1784308210102'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "builder_pages" ADD "settings" jsonb NOT NULL DEFAULT '{}'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "builder_pages" DROP COLUMN "settings"`);
    }

}
