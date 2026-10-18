import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ImagePageGeneration } from './image-page-generation.entity';

export type ImagePageGenerationMeta = { storeId: string; builderPageId: string; language: string; style: string };

// الحد الشهري لصفحات الصور (plan_features.imagePagesPerMonth، الشهر بتوقيت الجزائر).
// الحجز يتم تحت قفل لكل تاجر ثم يُحذف إن فشل الإنشاء — فلا تُحتسب صفحة فاشلة،
// ولا يبقى اتصال قاعدة البيانات مفتوحاً طوال طلب Claude.
@Injectable()
export class ImagePageQuotaService {
  constructor(private readonly ds: DataSource) { }

  async usage(userId: string, m: EntityManager = this.ds.manager): Promise<{ used: number; limit: number }> {
    const [plan] = await m.query(
      `SELECT f."imagePagesPerMonth" AS "limit"
         FROM subscriptions s
         JOIN plans p ON p.id = s."planId"
         JOIN plan_features f ON f.id = p."featuresId"
        WHERE s."userId"::text = $1 AND s.status = 'active' AND s."endDate" > now()
        ORDER BY s."startDate" DESC
        LIMIT 1`,
      [userId],
    ).catch(() => []);
    const [row] = await m.query(
      `SELECT count(*)::int AS count FROM image_page_generations
        WHERE "userId" = $1
          AND "createdAt" >= (date_trunc('month', now() AT TIME ZONE 'Africa/Algiers') AT TIME ZONE 'Africa/Algiers')`,
      [userId],
    );
    return { used: Number(row?.count) || 0, limit: plan ? Number(plan.limit) || 0 : 0 };
  }

  async consume<T>(userId: string, meta: ImagePageGenerationMeta, run: () => Promise<T>): Promise<T> {
    const reservedId = await this.ds.transaction(async (m) => {
      await m.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [userId]);
      const { used, limit } = await this.usage(userId, m);
      if (used >= limit) {
        throw new BadRequestException(
          limit ? `بلغت الحد الشهري: ${limit} صفحات صور — رقِّ خطتك لإنشاء المزيد` : 'صفحات الصور غير متاحة في خطتك — رقِّ خطتك',
        );
      }
      const row = await m.save(ImagePageGeneration, m.create(ImagePageGeneration, { userId, ...meta }));
      return row.id;
    });
    try {
      return await run();
    } catch (err) {
      await this.ds.getRepository(ImagePageGeneration).delete(reservedId).catch(() => undefined);
      throw err;
    }
  }
}
