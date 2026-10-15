import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ActivityAction, ActivityEntity, StoreActivity } from './entities/store-activity.entity';

export const ACTIVITY_RETENTION_DAYS = 90;

// جدول كل كيان، وحقل الاسم المعروض، وهل يدعم الحذف الناعم
export const ENTITY_SOURCES: Partial<Record<ActivityEntity, { table: string; nameColumn: string; softDelete?: boolean; columns?: string[]; key?: string }>> = {
  product: { table: 'products', nameColumn: 'name', softDelete: true },
  category: { table: 'categories', nameColumn: 'name', softDelete: true },
  domain: { table: 'domains', nameColumn: 'domain', softDelete: true },
  order: { table: 'orders', nameColumn: 'customerName' },
  store: { table: 'stores', nameColumn: 'name' },
  // تغيير الثيم = حقلا الثيم في صف المتجر
  theme: { table: 'stores', nameColumn: 'name', columns: ['themeId', 'themeUserId'] },
  group: { table: 'store_groups', nameColumn: 'name' },
  member: { table: 'store_members', nameColumn: 'userId' },
  // صف SEO واحد لكل متجر — معرّف السجل هو معرّف المتجر
  seo: { table: 'store_seo', nameColumn: 'metaTitle', key: 'storeId' },
};

// حقول لا معنى لتسجيلها أو استعادتها
const IGNORED = new Set(['updatedAt', 'updateAt', 'createdAt', 'createAt']);

const plain = (row: any) => (row ? JSON.parse(JSON.stringify(row)) : null);

export interface ActivityFilters {
  userId?: string;
  action?: ActivityAction;
  entity?: ActivityEntity;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class ActivityService {
  constructor(
    @InjectRepository(StoreActivity) private readonly repo: Repository<StoreActivity>,
    private readonly dataSource: DataSource,
  ) {}

  /** صف الكيان كما هو في قاعدة البيانات (بما فيه المحذوف ناعماً) */
  async snapshot(entity: ActivityEntity, id: string): Promise<Record<string, any> | null> {
    const src = ENTITY_SOURCES[entity];
    if (!src || !id) return null;
    const [row] = await this.dataSource.query(`SELECT * FROM "${src.table}" WHERE "${src.key ?? 'id'}" = $1`, [id]);
    if (!row) return null;
    const p = plain(row);
    // جدول مرتبط بالمتجر (SEO): معرّف الصف ومفتاحه ليسا تغييراً يُسجَّل
    if (src.key) { delete p.id; delete p[src.key]; }
    if (!src.columns) return p;
    return Object.fromEntries(src.columns.map((c) => [c, p[c] ?? null]));
  }

  nameOf(entity: ActivityEntity, row: Record<string, any> | null): string | null {
    const col = ENTITY_SOURCES[entity]?.nameColumn;
    const v = col && row ? row[col] : null;
    return v == null ? null : String(v).slice(0, 255);
  }

  /** الحقول التي تغيّرت فقط */
  diff(before: Record<string, any> | null, after: Record<string, any> | null) {
    const b: Record<string, any> = {};
    const a: Record<string, any> = {};
    const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
    for (const k of keys) {
      if (IGNORED.has(k)) continue;
      const bv = before?.[k] ?? null;
      const av = after?.[k] ?? null;
      if (JSON.stringify(bv) !== JSON.stringify(av)) { b[k] = bv; a[k] = av; }
    }
    return Object.keys(a).length ? { before: b, after: a } : null;
  }

  async log(input: {
    storeId: string; userId: string; action: ActivityAction; entity: ActivityEntity; entityId: string;
    entityName?: string | null; before?: Record<string, any> | null; after?: Record<string, any> | null;
  }) {
    return this.repo.save(this.repo.create({
      ...input,
      entityName: input.entityName ?? null,
      before: input.before ?? null,
      after: input.after ?? null,
    }));
  }

  /** بعد حذف ناعم: من حذف (المالك أو العضو) */
  async markDeletedBy(entity: ActivityEntity, id: string, actorId: string) {
    const src = ENTITY_SOURCES[entity];
    if (!src?.softDelete) return;
    await this.dataSource.query(`UPDATE "${src.table}" SET "deletedBy" = $2 WHERE id = $1 AND "deletedAt" IS NOT NULL`, [id, actorId]);
  }

  /** لا يرمي أبداً — فشل السجل لا يُفشل عملية التاجر */
  logSafe(input: Parameters<ActivityService['log']>[0]) {
    return this.log(input).catch((err) => console.error('[activity] log failed', input.entity, input.action, err?.message));
  }

  async list(storeId: string, f: ActivityFilters) {
    const take = Math.min(Math.max(Number(f.limit) || 30, 1), 100);
    const page = Math.max(Number(f.page) || 1, 1);
    const qb = this.repo.createQueryBuilder('a')
      .where('a.storeId = :storeId', { storeId })
      .andWhere(`a.createdAt > now() - interval '${ACTIVITY_RETENTION_DAYS} days'`);
    if (f.userId) qb.andWhere('a.userId = :userId', { userId: f.userId });
    if (f.action) qb.andWhere('a.action = :action', { action: f.action });
    if (f.entity) qb.andWhere('a.entity = :entity', { entity: f.entity });
    if (f.from) qb.andWhere('a.createdAt >= :from', { from: new Date(f.from) });
    if (f.to) qb.andWhere('a.createdAt <= :to', { to: new Date(f.to) });
    qb.orderBy('a.createdAt', 'DESC').skip((page - 1) * take).take(take);
    const [items, total] = await qb.getManyAndCount();

    // أسماء من قاموا بالعمل
    const ids = [...new Set(items.map((i) => i.userId))];
    const users: Array<{ id: string; username: string; image: string | null }> = ids.length
      ? await this.dataSource.query(`SELECT id, username, image FROM users WHERE id = ANY($1::uuid[])`, [ids])
      : [];
    const byId = new Map(users.map((u) => [u.id, u]));
    return {
      total, page, pages: Math.ceil(total / take),
      items: items.map((i) => ({ ...i, user: byId.get(i.userId) ? { id: i.userId, name: byId.get(i.userId)!.username, avatar: byId.get(i.userId)!.image } : null })),
    };
  }

  /**
   * استعادة من السجل: حذف ← إرجاع الصف المحذوف ناعماً؛ تعديل ← إعادة القيم السابقة.
   * إن عُدِّل الكيان بعد هذا السجل: 409 CONFLICT_NEWER_CHANGES إلا مع force.
   */
  async restore(storeId: string, activityId: string, actorId: string, force = false) {
    const entry = await this.repo.findOne({ where: { id: activityId, storeId } });
    if (!entry) throw new NotFoundException('السجل غير موجود');
    if (Date.now() - new Date(entry.createdAt).getTime() > ACTIVITY_RETENTION_DAYS * 86_400_000) {
      throw new BadRequestException({ code: 'EXPIRED', message: 'لا يمكن الاستعادة بعد 90 يوماً' });
    }
    const src = ENTITY_SOURCES[entry.entity];
    if (!src || !['delete', 'update'].includes(entry.action) || (entry.action === 'delete' && !src.softDelete)) {
      throw new BadRequestException({ code: 'NOT_RESTORABLE', message: 'هذا السجل لا يمكن استعادته' });
    }

    if (!force) {
      const [newer] = await this.dataSource.query(
        `SELECT 1 FROM store_activities WHERE "storeId" = $1 AND "entityId" = $2 AND "createdAt" > $3 AND id <> $4 LIMIT 1`,
        [storeId, entry.entityId, entry.createdAt, entry.id],
      );
      if (newer) throw new ConflictException({ code: 'CONFLICT_NEWER_CHANGES', message: 'تم تعديل هذا العنصر بعد هذا السجل؛ أرسل force: true للاستعادة رغم ذلك' });
    }

    const before = await this.snapshot(entry.entity, entry.entityId);
    if (!before) throw new NotFoundException({ code: 'ENTITY_GONE', message: 'العنصر لم يعد موجوداً (حُذف نهائياً)' });

    if (entry.action === 'delete') {
      if (!before.deletedAt) throw new BadRequestException({ code: 'NOT_DELETED', message: 'العنصر غير محذوف' });
      if (entry.entity === 'domain') {
        const [taken] = await this.dataSource.query(
          `SELECT 1 FROM domains WHERE domain = $1 AND id <> $2 AND "deletedAt" IS NULL`, [before.domain, entry.entityId]);
        if (taken) throw new ConflictException({ code: 'DOMAIN_TAKEN', message: 'هذا الدومين مستعمل الآن' });
      }
      await this.dataSource.query(`UPDATE "${src.table}" SET "deletedAt" = NULL, "deletedBy" = NULL WHERE id = $1`, [entry.entityId]);
    } else {
      await this.applyValues(src.table, entry.entityId, entry.before ?? {}, src.key);
    }

    const after = await this.snapshot(entry.entity, entry.entityId);
    const changes = this.diff(before, after);
    await this.log({
      storeId, userId: actorId, action: 'restore', entity: entry.entity, entityId: entry.entityId,
      entityName: this.nameOf(entry.entity, after), before: changes?.before ?? null, after: changes?.after ?? null,
    });
    return { restored: true, entity: entry.entity, entityId: entry.entityId };
  }

  // إعادة قيم أعمدة (json/jsonb تُرسل كنص JSON، والمصفوفات العادية كما هي)
  private async applyValues(table: string, id: string, values: Record<string, any>, key = 'id') {
    const cols = Object.keys(values).filter((c) => !IGNORED.has(c) && c !== 'id' && c !== key);
    if (!cols.length) return;
    const types: Array<{ column_name: string; data_type: string; is_nullable: string }> = await this.dataSource.query(
      `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = $1 AND column_name = ANY($2)`,
      [table, cols],
    );
    const typeOf = new Map(types.map((t) => [t.column_name, t.data_type]));
    const notNull = new Set(types.filter((t) => t.is_nullable === 'NO').map((t) => t.column_name));
    // null في عمود NOT NULL (الصف لم يكن موجوداً قبل التعديل) ← نترك القيمة الحالية
    const valid = cols.filter((c) => typeOf.has(c) && !(values[c] === null && notNull.has(c)));
    if (!valid.length) return;
    const params = valid.map((c) => {
      const v = values[c];
      return v !== null && typeof v === 'object' && ['json', 'jsonb'].includes(typeOf.get(c)!) ? JSON.stringify(v) : v;
    });
    const sets = valid.map((c, i) => `"${c}" = $${i + 2}`).join(', ');
    await this.dataSource.query(`UPDATE "${table}" SET ${sets} WHERE "${key}" = $1`, [id, ...params]);
  }

  /** تنظيف يومي: سجلات أقدم من 90 يوماً */
  async purgeOld() {
    const res = await this.dataSource.query(
      `DELETE FROM store_activities WHERE "createdAt" < now() - interval '${ACTIVITY_RETENTION_DAYS} days'`,
    );
    return Array.isArray(res) ? (res[1] ?? 0) : 0;
  }
}
