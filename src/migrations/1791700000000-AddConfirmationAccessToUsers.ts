import { MigrationInterface, QueryRunner } from "typeorm";

export class AddConfirmationAccessToUsers1791700000000 implements MigrationInterface {
    name = 'AddConfirmationAccessToUsers1791700000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."users_confirmationaccess_enum" AS ENUM('none', 'requested', 'granted', 'revoked')`);
        await queryRunner.query(`ALTER TABLE "users" ADD "confirmationAccess" "public"."users_confirmationaccess_enum" NOT NULL DEFAULT 'none'`);
        // من هو عضو في شركة تأكيد قبل هذه الصلاحية يحتفظ بها
        await queryRunner.query(`UPDATE "users" SET "confirmationAccess" = 'granted' WHERE id IN (SELECT "userId" FROM "confirmation_members")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "confirmationAccess"`);
        await queryRunner.query(`DROP TYPE "public"."users_confirmationaccess_enum"`);
    }

}
