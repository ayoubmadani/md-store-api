import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWhatsappToStoreContacts1791800000000 implements MigrationInterface {
  name = 'AddWhatsappToStoreContacts1791800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "store_contacts" ADD COLUMN IF NOT EXISTS "whatsapp" character varying`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "store_contacts" DROP COLUMN IF EXISTS "whatsapp"`);
  }
}
