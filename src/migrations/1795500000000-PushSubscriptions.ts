import { MigrationInterface, QueryRunner } from 'typeorm';

// أجهزة مسجّلة لإشعارات تطبيق الهاتف (Web Push): جهاز = endpoint فريد، لكل مستخدم عدة أجهزة
export class PushSubscriptions1795500000000 implements MigrationInterface {
  name = 'PushSubscriptions1795500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "push_subscriptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "endpoint" text NOT NULL,
        "p256dh" varchar(255) NOT NULL,
        "auth" varchar(255) NOT NULL,
        "userAgent" varchar(255),
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_push_subscriptions" PRIMARY KEY ("id")
      )`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_push_subscriptions_endpoint" ON "push_subscriptions" ("endpoint")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_push_subscriptions_user" ON "push_subscriptions" ("userId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "push_subscriptions"`);
  }
}
