import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConnectedClientToApiKeys1792100000000 implements MigrationInterface {
  name = 'AddConnectedClientToApiKeys1792100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "connectedClient" character varying(100)`);
    await queryRunner.query(`ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "connectedAt" TIMESTAMP`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "api_keys" DROP COLUMN IF EXISTS "connectedAt"`);
    await queryRunner.query(`ALTER TABLE "api_keys" DROP COLUMN IF EXISTS "connectedClient"`);
  }
}
