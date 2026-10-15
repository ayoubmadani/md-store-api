import { MigrationInterface, QueryRunner } from 'typeorm';

// مشاركة المتجر (فريق): مجموعات صلاحيات، أعضاء، سجل نشاط، حد الأعضاء في الخطة، وحذف ناعم للدومينات
export class StoreTeam1793600000000 implements MigrationInterface {
  name = 'StoreTeam1793600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plan_features" ADD COLUMN IF NOT EXISTS "maxMembers" integer NOT NULL DEFAULT 0`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "store_groups" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "storeId" uuid NOT NULL,
        "name" character varying(80) NOT NULL,
        "permissions" text[] NOT NULL DEFAULT '{}',
        "isActive" boolean NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_store_groups_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_store_groups_store" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_store_groups_store_name" ON "store_groups" ("storeId", "name")`);

    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE "store_members_status_enum" AS ENUM ('pending', 'accepted', 'rejected');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "store_members" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "storeId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "groupId" uuid NOT NULL,
        "status" "store_members_status_enum" NOT NULL DEFAULT 'pending',
        "invitedBy" uuid NOT NULL,
        "suspendedByPlan" boolean NOT NULL DEFAULT false,
        "joinedAt" TIMESTAMP,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_store_members_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_store_members_store" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_store_members_user" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_store_members_group" FOREIGN KEY ("groupId") REFERENCES "store_groups"("id") ON DELETE RESTRICT
      )`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "UQ_store_members_store_user" ON "store_members" ("storeId", "userId")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_store_members_user" ON "store_members" ("userId")`);

    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE "store_activities_action_enum" AS ENUM ('create', 'update', 'delete', 'restore');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    await queryRunner.query(`DO $$ BEGIN
      CREATE TYPE "store_activities_entity_enum" AS ENUM ('product', 'category', 'domain', 'order', 'store', 'theme', 'group', 'member');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "store_activities" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "storeId" uuid NOT NULL,
        "userId" uuid NOT NULL,
        "action" "store_activities_action_enum" NOT NULL,
        "entity" "store_activities_entity_enum" NOT NULL,
        "entityId" uuid NOT NULL,
        "entityName" character varying(255),
        "before" jsonb,
        "after" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_store_activities_id" PRIMARY KEY ("id")
      )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_store_activities_store_created" ON "store_activities" ("storeId", "createdAt")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_store_activities_entity" ON "store_activities" ("entityId", "createdAt")`);

    // حذف ناعم: الدومينات (المنتجات والتصنيفات لها deletedAt من قبل)
    await queryRunner.query(`ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "domains" ADD COLUMN IF NOT EXISTS "deletedBy" uuid`);
    await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "deletedBy" uuid`);
    await queryRunner.query(`ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "deletedBy" uuid`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "categories" DROP COLUMN IF EXISTS "deletedBy"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "deletedBy"`);
    await queryRunner.query(`ALTER TABLE "domains" DROP COLUMN IF EXISTS "deletedBy"`);
    await queryRunner.query(`ALTER TABLE "domains" DROP COLUMN IF EXISTS "deletedAt"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "store_activities"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "store_activities_entity_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "store_activities_action_enum"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "store_members"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "store_members_status_enum"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "store_groups"`);
    await queryRunner.query(`ALTER TABLE "plan_features" DROP COLUMN IF EXISTS "maxMembers"`);
  }
}
