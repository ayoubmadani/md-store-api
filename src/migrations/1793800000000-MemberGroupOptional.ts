import { MigrationInterface, QueryRunner } from 'typeorm';

// دعوة العضو أولاً ثم إسناده لمجموعة لاحقاً: groupId اختياري (بلا مجموعة = بلا صلاحيات)
export class MemberGroupOptional1793800000000 implements MigrationInterface {
  name = 'MemberGroupOptional1793800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "store_members" ALTER COLUMN "groupId" DROP NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "store_members" WHERE "groupId" IS NULL`);
    await queryRunner.query(`ALTER TABLE "store_members" ALTER COLUMN "groupId" SET NOT NULL`);
  }
}
