import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ActivityService, ACTIVITY_RETENTION_DAYS } from './activity.service';
import { DomainService } from '../domain/domain.service';

// تنظيف يومي (Vercel Cron): سجلات أقدم من 90 يوماً، والمحذوفات الناعمة الأقدم من 90 يوماً نهائياً
@Injectable()
export class TeamCleanupService {
  private readonly logger = new Logger(TeamCleanupService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly activity: ActivityService,
    private readonly domains: DomainService,
  ) {}

  async run() {
    const cutoff = `now() - interval '${ACTIVITY_RETENTION_DAYS} days'`;
    const activities = await this.activity.purgeOld();
    const result = { activities, products: 0, categories: 0, domains: 0, skipped: [] as Array<{ entity: string; id: string; reason: string }> };

    // منتجات: order_items مربوطة بـ CASCADE ← الحذف النهائي يمسح سجل الطلبات القديمة، فنتجاوز المنتج الذي له طلبات
    const products: Array<{ id: string; used: boolean }> = await this.dataSource.query(
      `SELECT p.id, EXISTS (SELECT 1 FROM order_items i WHERE i."productId" = p.id) AS used
         FROM products p WHERE p."deletedAt" IS NOT NULL AND p."deletedAt" < ${cutoff}`,
    );
    for (const p of products) {
      if (p.used) { result.skipped.push({ entity: 'product', id: p.id, reason: 'HAS_ORDERS' }); continue; }
      await this.tryDelete('products', p.id, result, 'product') && result.products++;
    }

    const categories: Array<{ id: string }> = await this.dataSource.query(
      `SELECT id FROM categories WHERE "deletedAt" IS NOT NULL AND "deletedAt" < ${cutoff}`,
    );
    for (const c of categories) await this.tryDelete('categories', c.id, result, 'category') && result.categories++;

    const domains: Array<{ id: string }> = await this.dataSource.query(
      `SELECT id FROM domains WHERE "deletedAt" IS NOT NULL AND "deletedAt" < ${cutoff}`,
    );
    for (const d of domains) {
      try {
        await this.domains.purgeDeleted(d.id);
        result.domains++;
      } catch (err: any) {
        result.skipped.push({ entity: 'domain', id: d.id, reason: err?.message ?? 'ERROR' });
      }
    }

    this.logger.log(`cleanup: ${JSON.stringify({ ...result, skipped: result.skipped.length })}`);
    return result;
  }

  // صف مرتبط بقيود أخرى (FK) يُتجاوز بدل أن يفشل التنظيف كله
  private async tryDelete(table: string, id: string, result: { skipped: any[] }, entity: string) {
    try {
      await this.dataSource.query(`DELETE FROM "${table}" WHERE id = $1 AND "deletedAt" IS NOT NULL`, [id]);
      return true;
    } catch (err: any) {
      result.skipped.push({ entity, id, reason: err?.code === '23503' ? 'REFERENCED' : err?.message ?? 'ERROR' });
      return false;
    }
  }
}
