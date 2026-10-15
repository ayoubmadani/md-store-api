import { MigrationInterface, QueryRunner } from 'typeorm';

// صلاحية SEO مستقلة للمجموعات: تعديلات SEO تُسجَّل في سجل النشاط (entity = seo)
export class ActivitySeoEntity1793900000000 implements MigrationInterface {
  name = 'ActivitySeoEntity1793900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "store_activities_entity_enum" ADD VALUE IF NOT EXISTS 'seo'`);
  }

  public async down(): Promise<void> {
    // Postgres لا يحذف قيمة من enum — نتركها (لا ضرر)
  }
}
