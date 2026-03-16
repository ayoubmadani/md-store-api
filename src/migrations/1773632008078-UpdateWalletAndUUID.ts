import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateWalletAndUUID1773632008078 implements MigrationInterface {
    name = 'UpdateWalletAndUUID1773632008078'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "plan_features" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "storeNumber" integer NOT NULL DEFAULT '0', "productNumber" integer NOT NULL DEFAULT '0', "landingPageNumber" integer NOT NULL DEFAULT '0', "isNtfy" boolean NOT NULL DEFAULT false, "pixelTiktokNumber" integer NOT NULL DEFAULT '0', "pixelFacebookNumber" integer NOT NULL DEFAULT '0', "commission" numeric(5,2) NOT NULL DEFAULT '0', "theme" json, CONSTRAINT "PK_eb2b32d1d93a8b2e96e122e3a77" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "plans" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "monthlyPrice" numeric(10,2) NOT NULL DEFAULT '0', "yearlyPrice" numeric(10,2) NOT NULL DEFAULT '0', "currency" character varying NOT NULL DEFAULT 'DZD', "stripePriceId" character varying, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "featuresId" uuid, CONSTRAINT "REL_f998a690a409e6e90f956c7030" UNIQUE ("featuresId"), CONSTRAINT "PK_3720521a81c7c24fe9b7202ba61" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "subscriptions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "planId" uuid NOT NULL, "status" "public"."subscriptions_status_enum" NOT NULL DEFAULT 'active', "interval" "public"."subscriptions_interval_enum" NOT NULL DEFAULT 'month', "stripeSubscriptionId" character varying, "startDate" TIMESTAMP NOT NULL, "endDate" TIMESTAMP NOT NULL, "cancelAtPeriodEnd" boolean NOT NULL DEFAULT false, "autoRenew" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a87248d73155605cf782be9ee5e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "plans" ADD CONSTRAINT "FK_f998a690a409e6e90f956c7030d" FOREIGN KEY ("featuresId") REFERENCES "plan_features"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_fbdba4e2ac694cf8c9cecf4dc84" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_7536cba909dd7584a4640cad7d5" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_7536cba909dd7584a4640cad7d5"`);
        await queryRunner.query(`ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_fbdba4e2ac694cf8c9cecf4dc84"`);
        await queryRunner.query(`ALTER TABLE "plans" DROP CONSTRAINT "FK_f998a690a409e6e90f956c7030d"`);
        await queryRunner.query(`DROP TABLE "subscriptions"`);
        await queryRunner.query(`DROP TABLE "plans"`);
        await queryRunner.query(`DROP TABLE "plan_features"`);
    }

}
