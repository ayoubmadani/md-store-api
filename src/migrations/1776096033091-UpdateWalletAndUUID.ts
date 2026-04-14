import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateWalletAndUUID1776096033091 implements MigrationInterface {
    name = 'UpdateWalletAndUUID1776096033091'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. إنشاء جداول الطلبات
        await queryRunner.query(`CREATE TABLE "order_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "orderId" uuid NOT NULL, "productId" uuid NOT NULL, "variantDetailId" uuid, "offerId" uuid, "quantity" integer NOT NULL DEFAULT '1', "finalPrice" numeric(10,2) NOT NULL, "totalPrice" numeric(10,2) NOT NULL, "unityPrice" numeric(10,2), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_005269d8574e6fac0493715c308" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "orders" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "cartId" uuid, "storeId" uuid NOT NULL, "customerId" character varying NOT NULL, "customerName" character varying NOT NULL, "customerPhone" character varying NOT NULL, "customerWilayaId" integer NOT NULL, "customerCommuneId" integer NOT NULL, "priceShip" numeric(10,2) NOT NULL DEFAULT '0', "priceLoss" numeric(10,2) NOT NULL DEFAULT '0', "typeShip" "public"."orders_typeship_enum" NOT NULL DEFAULT 'home', "totalCartPrice" numeric(10,2) NOT NULL DEFAULT '0', "status" "public"."orders_status_enum" NOT NULL DEFAULT 'pending', "platform" character varying, "lpId" uuid, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "confirmedAt" TIMESTAMP, "shippingAt" TIMESTAMP, "deliveredAt" TIMESTAMP, "postponedUntil" TIMESTAMP, "isUploadedShipping" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_710e2d4957aa5878dfe94e4ac2f" PRIMARY KEY ("id"))`);
        
        await queryRunner.query(`ALTER TABLE "store_shipping_settings" ALTER COLUMN "user_id" SET NOT NULL`);

        // 2. معالجة جدول message_admine (إضافة قيم افتراضية لتجنب خطأ NULL)
        await queryRunner.query(`ALTER TABLE "message_admine" DROP COLUMN IF EXISTS "username"`);
        await queryRunner.query(`ALTER TABLE "message_admine" ADD "username" character varying NOT NULL DEFAULT 'temporary'`);
        
        await queryRunner.query(`ALTER TABLE "message_admine" DROP COLUMN IF EXISTS "email"`);
        await queryRunner.query(`ALTER TABLE "message_admine" ADD "email" character varying NOT NULL DEFAULT 'temporary@mail.com'`);
        
        await queryRunner.query(`ALTER TABLE "message_admine" DROP COLUMN IF EXISTS "subject"`);
        await queryRunner.query(`ALTER TABLE "message_admine" ADD "subject" character varying NOT NULL DEFAULT 'no-subject'`);

        // إزالة القيم الافتراضية بعد الإنشاء لتبقى الحقول إجبارية مستقبلاً فقط
        await queryRunner.query(`ALTER TABLE "message_admine" ALTER COLUMN "username" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "message_admine" ALTER COLUMN "email" DROP DEFAULT`);
        await queryRunner.query(`ALTER TABLE "message_admine" ALTER COLUMN "subject" DROP DEFAULT`);

        await queryRunner.query(`ALTER TABLE "message_admine" ALTER COLUMN "is_replied" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "message_admine" ALTER COLUMN "is_archived" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "message_admine" ALTER COLUMN "created_at" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "message_admine" ALTER COLUMN "created_at" SET DEFAULT now()`);

        // 3. إضافة العلاقات (Constraints)
        await queryRunner.query(`ALTER TABLE "product_variants" ADD CONSTRAINT "FK_b41dfbf95f156aae9fdca612917" FOREIGN KEY ("ordersId") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "order_items" ADD CONSTRAINT "FK_f1d359a55923bb45b057fbdab0d" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "order_items" ADD CONSTRAINT "FK_cdb99c05982d5191ac8465ac010" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "order_items" ADD CONSTRAINT "FK_81ce8587f70ac6c5e9dd48c1681" FOREIGN KEY ("variantDetailId") REFERENCES "variant_details"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "order_items" ADD CONSTRAINT "FK_52b4bc1652998dd609949808f58" FOREIGN KEY ("offerId") REFERENCES "product_offers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_0f82354e5b05fd87884eff3a7b5" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_1e9411ff976485dd9fc47209c91" FOREIGN KEY ("customerWilayaId") REFERENCES "wilayas"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_4183c202764183e8b578a02efa2" FOREIGN KEY ("customerCommuneId") REFERENCES "communes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "FK_22993947772099159fe52c79212" FOREIGN KEY ("lpId") REFERENCES "landing-pages"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "store_shipping_settings" ADD CONSTRAINT "FK_0b2b61428f2b3fb22314ec71ea3" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // ... (يمكنك ترك كود down كما هو أو تحديثه لعكس التغييرات أعلاه)
        await queryRunner.query(`ALTER TABLE "store_shipping_settings" DROP CONSTRAINT "FK_0b2b61428f2b3fb22314ec71ea3"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_22993947772099159fe52c79212"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_4183c202764183e8b578a02efa2"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_1e9411ff976485dd9fc47209c91"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "FK_0f82354e5b05fd87884eff3a7b5"`);
        await queryRunner.query(`ALTER TABLE "order_items" DROP CONSTRAINT "FK_52b4bc1652998dd609949808f58"`);
        await queryRunner.query(`ALTER TABLE "order_items" DROP CONSTRAINT "FK_81ce8587f70ac6c5e9dd48c1681"`);
        await queryRunner.query(`ALTER TABLE "order_items" DROP CONSTRAINT "FK_cdb99c05982d5191ac8465ac010"`);
        await queryRunner.query(`ALTER TABLE "order_items" DROP CONSTRAINT "FK_f1d359a55923bb45b057fbdab0d"`);
        await queryRunner.query(`ALTER TABLE "product_variants" DROP CONSTRAINT "FK_b41dfbf95f156aae9fdca612917"`);
        await queryRunner.query(`DROP TABLE "orders"`);
        await queryRunner.query(`DROP TABLE "order_items"`);
    }
}