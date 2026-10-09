import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateConfirmationCompanies1791600000000 implements MigrationInterface {
    name = 'CreateConfirmationCompanies1791600000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // ── شركات التأكيد ──
        await queryRunner.query(`CREATE TYPE "public"."confirmation_companies_status_enum" AS ENUM('pending', 'approved', 'suspended')`);
        await queryRunner.query(`CREATE TABLE "confirmation_companies" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "name" character varying NOT NULL,
            "description" text,
            "phone" character varying NOT NULL,
            "logo" character varying,
            "wilayaId" integer,
            "commissionPerDelivered" numeric(10,2) NOT NULL,
            "status" "public"."confirmation_companies_status_enum" NOT NULL DEFAULT 'pending',
            "ownerId" uuid NOT NULL,
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
            "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "PK_confirmation_companies" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_confirmation_companies_status" ON "confirmation_companies" ("status")`);
        await queryRunner.query(`ALTER TABLE "confirmation_companies" ADD CONSTRAINT "FK_confirmation_companies_owner" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE`);
        await queryRunner.query(`ALTER TABLE "confirmation_companies" ADD CONSTRAINT "FK_confirmation_companies_wilaya" FOREIGN KEY ("wilayaId") REFERENCES "wilayas"("id")`);

        // ── أعضاء الشركة ──
        await queryRunner.query(`CREATE TYPE "public"."confirmation_members_role_enum" AS ENUM('owner', 'agent')`);
        await queryRunner.query(`CREATE TABLE "confirmation_members" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "companyId" uuid NOT NULL,
            "userId" uuid NOT NULL,
            "role" "public"."confirmation_members_role_enum" NOT NULL DEFAULT 'agent',
            "isActive" boolean NOT NULL DEFAULT true,
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "UQ_confirmation_members_user" UNIQUE ("userId"),
            CONSTRAINT "PK_confirmation_members" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "confirmation_members" ADD CONSTRAINT "FK_confirmation_members_company" FOREIGN KEY ("companyId") REFERENCES "confirmation_companies"("id") ON DELETE CASCADE`);
        await queryRunner.query(`ALTER TABLE "confirmation_members" ADD CONSTRAINT "FK_confirmation_members_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE`);

        // ── قائمة التاجر ──
        await queryRunner.query(`CREATE TABLE "store_confirmation_companies" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "storeId" uuid NOT NULL,
            "companyId" uuid NOT NULL,
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "UQ_store_confirmation_companies" UNIQUE ("storeId", "companyId"),
            CONSTRAINT "PK_store_confirmation_companies" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "store_confirmation_companies" ADD CONSTRAINT "FK_store_confirmation_companies_store" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE`);
        await queryRunner.query(`ALTER TABLE "store_confirmation_companies" ADD CONSTRAINT "FK_store_confirmation_companies_company" FOREIGN KEY ("companyId") REFERENCES "confirmation_companies"("id") ON DELETE CASCADE`);

        // ── سجل التأكيد ──
        await queryRunner.query(`CREATE TYPE "public"."confirmation_logs_action_enum" AS ENUM('sent', 'recalled', 'claimed', 'edited', 'status', 'released', 'uploaded', 'upload_failed', 'paid')`);
        await queryRunner.query(`CREATE TABLE "confirmation_logs" (
            "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
            "orderId" uuid NOT NULL,
            "companyId" uuid NOT NULL,
            "agentId" uuid,
            "action" "public"."confirmation_logs_action_enum" NOT NULL,
            "fromStatus" character varying,
            "toStatus" character varying,
            "note" text,
            "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
            CONSTRAINT "PK_confirmation_logs" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_confirmation_logs_company" ON "confirmation_logs" ("companyId", "createdAt")`);
        await queryRunner.query(`CREATE INDEX "IDX_confirmation_logs_agent" ON "confirmation_logs" ("agentId", "createdAt")`);
        await queryRunner.query(`ALTER TABLE "confirmation_logs" ADD CONSTRAINT "FK_confirmation_logs_order" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE`);

        // ── أعمدة الطلب: التأكيد + تتبع الشحن ──
        await queryRunner.query(`ALTER TABLE "orders"
            ADD "shippingTrackingId" character varying,
            ADD "shippingProviderStatus" character varying,
            ADD "shippingCheckedAt" TIMESTAMP,
            ADD "confirmationCompanyId" uuid,
            ADD "confirmationAgentId" uuid,
            ADD "confirmationSentAt" TIMESTAMP,
            ADD "confirmationLockedUntil" TIMESTAMP,
            ADD "confirmationNextAttemptAt" TIMESTAMP,
            ADD "confirmationCommission" numeric(10,2),
            ADD "confirmationPlatformRate" numeric(5,4),
            ADD "confirmationPaidAt" TIMESTAMP`);
        await queryRunner.query(`CREATE INDEX "IDX_orders_confirmation_company_status" ON "orders" ("confirmationCompanyId", "status")`);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_orders_confirmation_company" FOREIGN KEY ("confirmationCompanyId") REFERENCES "confirmation_companies"("id") ON DELETE SET NULL`);

        // ── أنواع معاملات العمولة ──
        await queryRunner.query(`ALTER TYPE "public"."transactions_type_enum" ADD VALUE IF NOT EXISTS 'confirmation_fee'`);
        await queryRunner.query(`ALTER TYPE "public"."transactions_type_enum" ADD VALUE IF NOT EXISTS 'confirmation_earning'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // قيم enum المعاملات لا تُحذف (Postgres لا يدعم حذف قيمة من enum)
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_orders_confirmation_company"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_orders_confirmation_company_status"`);
        await queryRunner.query(`ALTER TABLE "orders"
            DROP COLUMN "confirmationPaidAt",
            DROP COLUMN "confirmationPlatformRate",
            DROP COLUMN "confirmationCommission",
            DROP COLUMN "confirmationNextAttemptAt",
            DROP COLUMN "confirmationLockedUntil",
            DROP COLUMN "confirmationSentAt",
            DROP COLUMN "confirmationAgentId",
            DROP COLUMN "confirmationCompanyId",
            DROP COLUMN "shippingCheckedAt",
            DROP COLUMN "shippingProviderStatus",
            DROP COLUMN "shippingTrackingId"`);
        await queryRunner.query(`DROP TABLE "confirmation_logs"`);
        await queryRunner.query(`DROP TYPE "public"."confirmation_logs_action_enum"`);
        await queryRunner.query(`DROP TABLE "store_confirmation_companies"`);
        await queryRunner.query(`DROP TABLE "confirmation_members"`);
        await queryRunner.query(`DROP TYPE "public"."confirmation_members_role_enum"`);
        await queryRunner.query(`DROP TABLE "confirmation_companies"`);
        await queryRunner.query(`DROP TYPE "public"."confirmation_companies_status_enum"`);
    }

}
