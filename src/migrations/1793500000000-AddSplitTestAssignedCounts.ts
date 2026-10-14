import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSplitTestAssignedCounts1793500000000 implements MigrationInterface {
  name = 'AddSplitTestAssignedCounts1793500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // عدد الزوار الجدد الذين أُعطيت لهم كل صفحة — للتوزيع المتوازن بدل القرعة
    await queryRunner.query(`ALTER TABLE "split_tests" ADD COLUMN IF NOT EXISTS "assignedCounts" jsonb NOT NULL DEFAULT '{}'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "split_tests" DROP COLUMN IF EXISTS "assignedCounts"`);
  }
}
