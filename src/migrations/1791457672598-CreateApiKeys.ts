import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateApiKeys1791457672598 implements MigrationInterface {
    name = 'CreateApiKeys1791457672598'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "api_keys" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "name" character varying(100) NOT NULL, "keyHash" character varying(64) NOT NULL, "prefix" character varying(8) NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "revokedAt" TIMESTAMP, "lastUsedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_df3b25181df0b4b59bd93f16e10" UNIQUE ("keyHash"), CONSTRAINT "PK_5c8a79801b44bd27b79228e1dad" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "api_keys" ADD CONSTRAINT "FK_6c2e267ae764a9413b863a29342" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "api_keys" DROP CONSTRAINT "FK_6c2e267ae764a9413b863a29342"`);
        await queryRunner.query(`DROP TABLE "api_keys"`);
    }

}
