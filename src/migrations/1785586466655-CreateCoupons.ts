import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCoupons1785586466655 implements MigrationInterface {
    name = 'CreateCoupons1785586466655'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."coupons_discounttype_enum" AS ENUM('percentage', 'fixed')`);
        await queryRunner.query(`CREATE TYPE "public"."coupons_scope_enum" AS ENUM('plan', 'theme', 'both')`);
        await queryRunner.query(`CREATE TABLE "coupons" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" character varying(50) NOT NULL, "description" character varying(255), "discountType" "public"."coupons_discounttype_enum" NOT NULL, "discountValue" numeric(10,2) NOT NULL, "scope" "public"."coupons_scope_enum" NOT NULL DEFAULT 'both', "maxUses" integer, "usedCount" integer NOT NULL DEFAULT '0', "maxUsesPerUser" integer, "startsAt" TIMESTAMP, "expiresAt" TIMESTAMP, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_e025109230e82925843f2a14c48" UNIQUE ("code"), CONSTRAINT "PK_d7ea8864a0150183770f3e9a8cb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."coupon_redemptions_context_enum" AS ENUM('plan_subscription', 'plan_upgrade', 'theme_purchase')`);
        await queryRunner.query(`CREATE TABLE "coupon_redemptions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "couponId" uuid NOT NULL, "userId" uuid NOT NULL, "context" "public"."coupon_redemptions_context_enum" NOT NULL, "contextId" character varying, "basePrice" numeric(10,2) NOT NULL, "discountAmount" numeric(10,2) NOT NULL, "finalPrice" numeric(10,2) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5086813ea980d21dbeb190ed0a7" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "FK_26b8ad24ace2974b2b6c2047d3a" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "FK_21b5ef20634735e39029e178e7e" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`CREATE INDEX "IDX_coupon_redemptions_couponId_userId" ON "coupon_redemptions" ("couponId", "userId")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_coupon_redemptions_couponId_userId"`);
        await queryRunner.query(`ALTER TABLE "coupon_redemptions" DROP CONSTRAINT "FK_21b5ef20634735e39029e178e7e"`);
        await queryRunner.query(`ALTER TABLE "coupon_redemptions" DROP CONSTRAINT "FK_26b8ad24ace2974b2b6c2047d3a"`);
        await queryRunner.query(`DROP TABLE "coupon_redemptions"`);
        await queryRunner.query(`DROP TYPE "public"."coupon_redemptions_context_enum"`);
        await queryRunner.query(`DROP TABLE "coupons"`);
        await queryRunner.query(`DROP TYPE "public"."coupons_scope_enum"`);
        await queryRunner.query(`DROP TYPE "public"."coupons_discounttype_enum"`);
    }

}
