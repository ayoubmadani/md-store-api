import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateStoreNiche1772823500912 implements MigrationInterface {
    name = 'UpdateStoreNiche1772823500912'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "admin" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "username" character varying NOT NULL, "email" character varying NOT NULL, "key" integer NOT NULL, "password" character varying NOT NULL, CONSTRAINT "PK_e032310bcef831fb83101899b10" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "admin"`);
    }

}
