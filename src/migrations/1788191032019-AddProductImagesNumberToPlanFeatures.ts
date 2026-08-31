import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProductImagesNumberToPlanFeatures1788191032019 implements MigrationInterface {
    name = 'AddProductImagesNumberToPlanFeatures1788191032019'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "plan_features" ADD "productImagesNumber" integer NOT NULL DEFAULT 20`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "plan_features" DROP COLUMN "productImagesNumber"`);
    }

}
