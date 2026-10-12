import { MigrationInterface, QueryRunner } from 'typeorm';

// حدّ عدد الدومينات لكل متجر في ميزات الخطة (الخطط الحالية تبدأ بـ 3)
export class AddDomainNumberToPlanFeatures1792800000000 implements MigrationInterface {
  name = 'AddDomainNumberToPlanFeatures1792800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plan_features" ADD COLUMN IF NOT EXISTS "domainNumber" integer NOT NULL DEFAULT 3`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "plan_features" DROP COLUMN IF EXISTS "domainNumber"`);
  }
}
