import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIsTrialToSubscriptions1793300000000 implements MigrationInterface {
  name = 'AddIsTrialToSubscriptions1793300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "isTrial" boolean NOT NULL DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "isTrial"`);
  }
}
