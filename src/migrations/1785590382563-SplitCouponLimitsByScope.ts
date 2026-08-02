import { MigrationInterface, QueryRunner } from "typeorm";

export class SplitCouponLimitsByScope1785590382563 implements MigrationInterface {
    name = 'SplitCouponLimitsByScope1785590382563'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1) Add the new per-scope columns (nullable for now so we can backfill)
        await queryRunner.query(`ALTER TABLE "coupons" ADD "maxUsesPlan" integer`);
        await queryRunner.query(`ALTER TABLE "coupons" ADD "usedCountPlan" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "coupons" ADD "maxUsesPerUserPlan" integer`);
        await queryRunner.query(`ALTER TABLE "coupons" ADD "maxUsesTheme" integer`);
        await queryRunner.query(`ALTER TABLE "coupons" ADD "usedCountTheme" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "coupons" ADD "maxUsesPerUserTheme" integer`);

        // 2) Carry the old single limit over to both sides — admins can split them apart afterwards
        await queryRunner.query(`UPDATE "coupons" SET "maxUsesPlan" = "maxUses", "maxUsesTheme" = "maxUses"`);
        await queryRunner.query(`UPDATE "coupons" SET "maxUsesPerUserPlan" = "maxUsesPerUser", "maxUsesPerUserTheme" = "maxUsesPerUser"`);

        // 3) Backfill real usage counts from the redemption history itself (not from the old
        //    combined counter), so already-used coupons keep an accurate per-type count.
        await queryRunner.query(`
            UPDATE "coupons" c
            SET "usedCountPlan" = COALESCE((
                SELECT COUNT(*) FROM "coupon_redemptions" r
                WHERE r."couponId" = c."id" AND r."context" IN ('plan_subscription', 'plan_upgrade')
            ), 0)
        `);
        await queryRunner.query(`
            UPDATE "coupons" c
            SET "usedCountTheme" = COALESCE((
                SELECT COUNT(*) FROM "coupon_redemptions" r
                WHERE r."couponId" = c."id" AND r."context" = 'theme_purchase'
            ), 0)
        `);

        // 4) Drop the old combined columns
        await queryRunner.query(`ALTER TABLE "coupons" DROP COLUMN "maxUses"`);
        await queryRunner.query(`ALTER TABLE "coupons" DROP COLUMN "usedCount"`);
        await queryRunner.query(`ALTER TABLE "coupons" DROP COLUMN "maxUsesPerUser"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "coupons" ADD "maxUses" integer`);
        await queryRunner.query(`ALTER TABLE "coupons" ADD "usedCount" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "coupons" ADD "maxUsesPerUser" integer`);

        await queryRunner.query(`UPDATE "coupons" SET "usedCount" = "usedCountPlan" + "usedCountTheme"`);
        await queryRunner.query(`UPDATE "coupons" SET "maxUses" = COALESCE("maxUsesPlan", "maxUsesTheme")`);
        await queryRunner.query(`UPDATE "coupons" SET "maxUsesPerUser" = COALESCE("maxUsesPerUserPlan", "maxUsesPerUserTheme")`);

        await queryRunner.query(`ALTER TABLE "coupons" DROP COLUMN "maxUsesPerUserTheme"`);
        await queryRunner.query(`ALTER TABLE "coupons" DROP COLUMN "usedCountTheme"`);
        await queryRunner.query(`ALTER TABLE "coupons" DROP COLUMN "maxUsesTheme"`);
        await queryRunner.query(`ALTER TABLE "coupons" DROP COLUMN "maxUsesPerUserPlan"`);
        await queryRunner.query(`ALTER TABLE "coupons" DROP COLUMN "usedCountPlan"`);
        await queryRunner.query(`ALTER TABLE "coupons" DROP COLUMN "maxUsesPlan"`);
    }

}
