import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { StatusEnum } from '../order/entities/order.entity';
import { ShippingProviderService } from '../shipping-provider/shipping-provider.service';
import { ConfirmationBillingService } from '../confirmation/confirmation-billing.service';
import { mapProviderStatus, rawProviderStatus } from './provider-status';

const BATCH = 50; // طلبيات في كل دفعة
const TIME_BUDGET_MS = 240_000; // دالة Vercel تتوقف بعد 300 ثانية — نتوقف قبلها بهامش
const RECHECK_MINUTES = 30; // لا نسأل عن نفس الطرد أكثر من مرة كل 30 دقيقة

/**
 * مزامنة حالة الطلبيات "قيد الشحن" مع شركات التوصيل عبر رقم التتبع:
 * مسلَّم أو مرتجع نهائياً ← تتغير حالة الطلبية، وعند التسليم تُدفع عمولة
 * شركة التأكيد (إن وُجدت). أي حالة أخرى تُحفظ للعرض فقط.
 */
@Injectable()
export class ShippingSyncService {
  private readonly logger = new Logger(ShippingSyncService.name);
  private running = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly shipping: ShippingProviderService,
    private readonly billing: ConfirmationBillingService,
  ) {}

  // يعمل فقط حين يكون الـ API خادماً دائماً (أو محلياً). على Vercel لا يعمل @Cron —
  // هناك Vercel Cron يستدعي /internal/cron/shipping-sync مرة يومياً (خطة Hobby)
  @Cron('*/30 * * * *')
  async scheduled() {
    await this.sync();
  }

  async sync() {
    if (this.running) return { skipped: true };
    this.running = true;
    const result = {
      checked: 0,
      delivered: 0,
      returned: 0,
      errors: 0,
      timedOut: false,
    };
    const started = Date.now();
    try {
      // التشغيل اليومي (Vercel Hobby) يجب أن يمر على كل الطلبيات: دفعات متتالية حتى تنتهي
      // أو ينفد الوقت. الطلبية المفحوصة لا تعود قبل 30 دقيقة، فلا تتكرر في نفس التشغيل.
      for (;;) {
        if (Date.now() - started > TIME_BUDGET_MS) {
          result.timedOut = true;
          break;
        }
        const orders: Array<{
          id: string;
          storeId: string;
          trackingId: string;
          merchantId: string;
        }> = await this.dataSource.query(
          `SELECT o.id, o."storeId", o."shippingTrackingId" AS "trackingId", s."userId" AS "merchantId"
           FROM "orders" o JOIN "stores" s ON s.id = o."storeId"
          WHERE o.status = $1
            AND o."shippingTrackingId" IS NOT NULL
            AND (o."shippingCheckedAt" IS NULL OR o."shippingCheckedAt" < now() - make_interval(mins => $2))
          ORDER BY o."shippingCheckedAt" ASC NULLS FIRST
          LIMIT $3`,
          [StatusEnum.SHIPPING, RECHECK_MINUTES, BATCH],
        );
        if (!orders.length) break;

        for (const order of orders) {
          result.checked++;
          try {
            const parcel = await this.shipping.getOrder(
              order.storeId,
              order.merchantId,
              order.trackingId,
            );
            const raw = rawProviderStatus(parcel as Record<string, unknown>);
            const next = mapProviderStatus(raw);

            // الشرط status = shipping يمنع الكتابة فوق تغيير حدث أثناء المزامنة
            await this.dataSource.query(
              `UPDATE "orders"
                SET "shippingProviderStatus" = $2,
                    "shippingCheckedAt" = now(),
                    status = COALESCE($3::orders_status_enum, status),
                    "deliveredAt" = CASE WHEN $3 = 'delivered' THEN now() ELSE "deliveredAt" END
              WHERE id = $1 AND status = $4`,
              [order.id, raw, next, StatusEnum.SHIPPING],
            );

            if (next === StatusEnum.DELIVERED) {
              result.delivered++;
              await this.billing.settleIfDelivered(order.id);
            } else if (next === StatusEnum.RETURNED) {
              result.returned++;
            }
          } catch (err) {
            result.errors++;
            // لا نعيد المحاولة فوراً على طرد يفشل (شركة لا تدعم التتبع، حساب محذوف...)
            await this.dataSource.query(
              `UPDATE "orders" SET "shippingCheckedAt" = now() WHERE id = $1`,
              [order.id],
            );
            this.logger.warn(
              `Tracking ${order.trackingId} (order ${order.id}): ${(err as Error)?.message}`,
            );
          }
          if (Date.now() - started > TIME_BUDGET_MS) break;
        }
      }
      if (result.checked)
        this.logger.log(`Shipping sync: ${JSON.stringify(result)}`);
      return result;
    } finally {
      this.running = false;
    }
  }
}
