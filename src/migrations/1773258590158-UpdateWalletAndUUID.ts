import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateWalletAndUUID1773258590158 implements MigrationInterface {
    name = 'UpdateWalletAndUUID1773258590158'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."transactions_action_enum" RENAME TO "transactions_action_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."transactions_action_enum" AS ENUM('payment', 'deposit')`);
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "action" TYPE "public"."transactions_action_enum" USING "action"::"text"::"public"."transactions_action_enum"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_action_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."transactions_type_enum" RENAME TO "transactions_type_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."transactions_type_enum" AS ENUM('plan_subscription', 'plan_upgrade', 'store_fee', 'refund', 'sell_theme', 'top_up')`);
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "type" TYPE "public"."transactions_type_enum" USING "type"::"text"::"public"."transactions_type_enum"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_type_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."transactions_type_enum_old" AS ENUM('subscription', 'sell theme', 'top up wallet')`);
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "type" TYPE "public"."transactions_type_enum_old" USING "type"::"text"::"public"."transactions_type_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_type_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."transactions_type_enum_old" RENAME TO "transactions_type_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."transactions_action_enum_old" AS ENUM('withdraw', 'deposit')`);
        await queryRunner.query(`ALTER TABLE "transactions" ALTER COLUMN "action" TYPE "public"."transactions_action_enum_old" USING "action"::"text"::"public"."transactions_action_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."transactions_action_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."transactions_action_enum_old" RENAME TO "transactions_action_enum"`);
    }

}
