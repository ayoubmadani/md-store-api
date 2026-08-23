import { MigrationInterface, QueryRunner } from "typeorm";

export class AddThemeAndPlanReferenceToTransactions1787496316570 implements MigrationInterface {
    name = 'AddThemeAndPlanReferenceToTransactions1787496316570'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transactions" ADD "themeId" uuid`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD "planId" uuid`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_transactions_themeId" FOREIGN KEY ("themeId") REFERENCES "theme"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "transactions" ADD CONSTRAINT "FK_transactions_planId" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_transactions_planId"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP CONSTRAINT "FK_transactions_themeId"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "planId"`);
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "themeId"`);
    }

}
