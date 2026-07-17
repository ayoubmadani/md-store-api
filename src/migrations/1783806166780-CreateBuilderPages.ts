import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateBuilderPages1783806166780 implements MigrationInterface {
    name = 'CreateBuilderPages1783806166780'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "builder_pages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "storeId" character varying NOT NULL, "tree" jsonb NOT NULL DEFAULT '[]', "publishedUrl" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_builder_pages_id" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "builder_pages"`);
    }

}
