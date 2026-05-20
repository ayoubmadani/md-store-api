import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateWalletAndUUID1779238486456 implements MigrationInterface {
    name = 'UpdateWalletAndUUID1779238486456'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "categories" DROP CONSTRAINT "FK_9a6f051e66982b5f0318981bcaa"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a8a585f8f8acb7dba7112b9ee6"`);
        await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN "mpath"`);
        await queryRunner.query(`ALTER TABLE "categories" ADD CONSTRAINT "FK_9a6f051e66982b5f0318981bcaa" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "categories" DROP CONSTRAINT "FK_9a6f051e66982b5f0318981bcaa"`);
        await queryRunner.query(`ALTER TABLE "categories" ADD "mpath" character varying`);
        await queryRunner.query(`CREATE INDEX "IDX_a8a585f8f8acb7dba7112b9ee6" ON "categories" ("parentId", "storeId") `);
        await queryRunner.query(`ALTER TABLE "categories" ADD CONSTRAINT "FK_9a6f051e66982b5f0318981bcaa" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
