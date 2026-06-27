import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateWalletAndUUID1782584515395 implements MigrationInterface {
    name = 'UpdateWalletAndUUID1782584515395'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "support_users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "supportId" uuid NOT NULL, "userId" uuid NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d4261c24987eb5f9e12891a18b9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "support_users" ADD CONSTRAINT "FK_f621bedc92dfcd1f68772ad4f01" FOREIGN KEY ("supportId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "support_users" ADD CONSTRAINT "FK_1282945fba7682bf3285bc626d0" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "support_users" DROP CONSTRAINT "FK_1282945fba7682bf3285bc626d0"`);
        await queryRunner.query(`ALTER TABLE "support_users" DROP CONSTRAINT "FK_f621bedc92dfcd1f68772ad4f01"`);
        await queryRunner.query(`DROP TABLE "support_users"`);
    }

}
