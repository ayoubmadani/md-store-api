import { MigrationInterface, QueryRunner } from 'typeorm';

// اختيار الثيم صار للمالك فقط (الثيمات المتاحة حسب خطته) ← إزالة theme.change من المجموعات
export class RemoveThemePermission1794000000000 implements MigrationInterface {
  name = 'RemoveThemePermission1794000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "store_groups" SET "permissions" = array_remove("permissions", 'theme.change') WHERE 'theme.change' = ANY("permissions")`);
  }

  public async down(): Promise<void> {
    // لا رجوع: الصلاحية لم تعد موجودة
  }
}
