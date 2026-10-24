import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as webpush from 'web-push';
import { PushPayload, newOrderPayload } from './push.payload';

type Sub = { id: string; endpoint: string; p256dh: string; auth: string };

// مفاتيح VAPID تُولَّد مرة واحدة وتُحفظ في platform_settings (مفتاح مخفي لا تعرضه لوحة الإدارة) — بلا متغير بيئة
const VAPID_KEY = 'vapidKeys';
const SUBJECT = 'mailto:support@mdstore.top';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private keys: { publicKey: string; privateKey: string } | null = null;

  constructor(private readonly dataSource: DataSource) {}

  private async vapid() {
    if (this.keys) return this.keys;
    const [row] = await this.dataSource.query(`SELECT value FROM platform_settings WHERE key = $1`, [VAPID_KEY]);
    if (row?.value?.publicKey) return (this.keys = row.value);
    const fresh = webpush.generateVAPIDKeys();
    // ON CONFLICT: نسختان من الخادم تولّدان معاً → تبقى الأولى، ونقرأها
    await this.dataSource.query(
      `INSERT INTO platform_settings (key, value, "updatedAt") VALUES ($1, $2, now()) ON CONFLICT (key) DO NOTHING`,
      [VAPID_KEY, JSON.stringify(fresh)],
    );
    const [saved] = await this.dataSource.query(`SELECT value FROM platform_settings WHERE key = $1`, [VAPID_KEY]);
    return (this.keys = saved.value);
  }

  async publicKey() {
    return { publicKey: (await this.vapid()).publicKey };
  }

  async subscribe(userId: string, sub: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }, userAgent?: string) {
    if (!sub?.endpoint?.startsWith('https://') || !sub.keys?.p256dh || !sub.keys?.auth) throw new BadRequestException('اشتراك غير صالح');
    // نفس الجهاز لمستخدم آخر (تبديل حساب) ← يصبح لهذا المستخدم
    await this.dataSource.query(
      `INSERT INTO push_subscriptions ("userId", endpoint, p256dh, auth, "userAgent") VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (endpoint) DO UPDATE SET "userId" = EXCLUDED."userId", p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, "userAgent" = EXCLUDED."userAgent"`,
      [userId, sub.endpoint, sub.keys.p256dh.slice(0, 255), sub.keys.auth.slice(0, 255), userAgent?.slice(0, 255) ?? null],
    );
    return { ok: true };
  }

  async unsubscribe(userId: string, endpoint: string) {
    await this.dataSource.query(`DELETE FROM push_subscriptions WHERE "userId" = $1 AND endpoint = $2`, [userId, endpoint]);
    return { ok: true };
  }

  private async deliver(sub: Sub, payload: PushPayload) {
    const { publicKey, privateKey } = await this.vapid();
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { vapidDetails: { subject: SUBJECT, publicKey, privateKey }, TTL: 60 * 60 * 24, urgency: 'high' },
    );
  }

  /** يرسل لكل أجهزة هؤلاء المستخدمين؛ الأجهزة التي لم تعد موجودة (404/410) تُحذف */
  async sendToUsers(userIds: string[], payload: PushPayload) {
    if (!userIds.length) return;
    const subs: Sub[] = await this.dataSource.query(
      `SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE "userId"::text = ANY($1)`, [userIds],
    );
    const gone: string[] = [];
    await Promise.all(subs.map(async (s) => {
      try {
        await this.deliver(s, payload);
      } catch (e: any) {
        if (e?.statusCode === 404 || e?.statusCode === 410) gone.push(s.id);
        else this.logger.warn(`push failed (${e?.statusCode ?? '?'}): ${e?.message}`);
      }
    }));
    if (gone.length) await this.dataSource.query(`DELETE FROM push_subscriptions WHERE id = ANY($1)`, [gone]);
  }

  /** من يستقبل إشعارات طلبات المتجر: المالك + أعضاء مقبولون، مجموعتهم مفعّلة ولها صلاحية الطلبات */
  private async orderRecipients(storeId: string): Promise<{ ids: string[]; storeName: string }> {
    const rows: { userId: string; storeName: string }[] = await this.dataSource.query(
      `SELECT s."userId", s.name AS "storeName" FROM stores s WHERE s.id::text = $1
       UNION
       SELECT m."userId", s.name FROM store_members m
         JOIN stores s ON s.id = m."storeId"
         JOIN store_groups g ON g.id = m."groupId"
        WHERE m."storeId"::text = $1 AND m.status = 'accepted' AND NOT m."suspendedByPlan" AND g."isActive"
          AND ('order.view' = ANY(g.permissions) OR '*' = ANY(g.permissions))`,
      [storeId],
    );
    return { ids: [...new Set(rows.map((r) => String(r.userId)))], storeName: rows[0]?.storeName ?? 'MD Store' };
  }

  /** بعد إنشاء طلب — لا يرمي أبداً (الإشعار لا يُفشل الطلب) */
  async notifyNewOrder(order: Parameters<typeof newOrderPayload>[0] & { storeId: string }) {
    try {
      const { ids, storeName } = await this.orderRecipients(order.storeId);
      await this.sendToUsers(ids, newOrderPayload(order, storeName));
    } catch (e: any) {
      this.logger.warn(`notifyNewOrder: ${e?.message}`);
    }
  }
}
