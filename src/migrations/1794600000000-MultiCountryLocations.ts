import { MigrationInterface, QueryRunner } from 'typeorm';

// دول متعددة: كل منطقة/بلدية تحمل دولتها. الأرقام فريدة عبر كل الدول (الجزائر بأرقامها الأصلية،
// وباقي الدول برمز ISO الرقمي — انظر mdstore-locations)، فلا تتغير المفاتيح ولا العلاقات الحالية.
export class MultiCountryLocations1794600000000 implements MigrationInterface {
  name = 'MultiCountryLocations1794600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "wilayas" ADD COLUMN IF NOT EXISTS "country" varchar(2) NOT NULL DEFAULT 'DZ'`);
    await queryRunner.query(`ALTER TABLE "communes" ADD COLUMN IF NOT EXISTS "country" varchar(2) NOT NULL DEFAULT 'DZ'`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_wilayas_country" ON "wilayas" ("country")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_wilayas_country"`);
    await queryRunner.query(`ALTER TABLE "communes" DROP COLUMN IF EXISTS "country"`);
    await queryRunner.query(`ALTER TABLE "wilayas" DROP COLUMN IF EXISTS "country"`);
  }
}
