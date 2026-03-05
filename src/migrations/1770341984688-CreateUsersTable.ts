import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateUsersTable1770341984688 implements MigrationInterface {
    name = 'CreateUsersTable1770341984688'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."users_provider_enum" AS ENUM('CREDENTIALS', 'GOOGLE', 'CREDENTIALS_GOOGLE')`);
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('NORMAL_USER', 'ADMIN')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "username" character varying NOT NULL, "email" character varying NOT NULL, "phone" character varying, "provider" "public"."users_provider_enum" NOT NULL DEFAULT 'CREDENTIALS', "role" "public"."users_role_enum" NOT NULL DEFAULT 'NORMAL_USER', "password" character varying, "image" character varying, "otp" integer, "isVerified" boolean NOT NULL DEFAULT false, "otpExpires" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
        await queryRunner.query(`DROP TYPE "public"."users_provider_enum"`);
    }

}
