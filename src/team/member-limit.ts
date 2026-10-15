import { DataSource, EntityManager } from 'typeorm';

// حدود الفريق — SQL خام عمداً حتى يستدعيها SubscriptionService والدعم والـ cron بلا تبعيات دائرية.
// العضو = مستخدم مختلف (DISTINCT) عبر كل متاجر المالك، حالته accepted أو pending. الشخص في عدة متاجر يُحسب مرة.

type Db = DataSource | EntityManager;

/** maxMembers من خطة المالك النشطة غير المنتهية؛ null = لا خطة نشطة */
export async function ownerMemberLimit(db: Db, ownerId: string): Promise<number | null> {
  const [row] = await db.query(
    `SELECT f."maxMembers" AS "maxMembers"
       FROM subscriptions s
       JOIN plans p ON p.id = s."planId"
       JOIN plan_features f ON f.id = p."featuresId"
      WHERE s."userId"::text = $1 AND s.status = 'active' AND s."endDate" > now()
      ORDER BY s."startDate" DESC
      LIMIT 1`,
    [ownerId],
  );
  return row ? Number(row.maxMembers) || 0 : null;
}

/** المستخدمون المختلفون (accepted/pending) عبر متاجر المالك؛ activeOnly = غير المعلّقين فقط */
export async function distinctMemberIds(db: Db, ownerId: string, activeOnly = false): Promise<string[]> {
  const rows: Array<{ userId: string }> = await db.query(
    `SELECT DISTINCT m."userId"
       FROM store_members m JOIN stores s ON s.id = m."storeId"
      WHERE s."userId"::text = $1 AND m.status IN ('accepted', 'pending')
        ${activeOnly ? 'AND m."suspendedByPlan" = false' : ''}`,
    [ownerId],
  );
  return rows.map((r) => r.userId);
}

/**
 * يطبّق حد الخطة على الأعضاء بعد أي تغيير في خطة المالك (تخفيض، ترقية، انتهاء، تجديد):
 * - أكثر من الحد ← تعليق الأحدث انضماماً (كل عضوياته عند هذا المالك) حتى يعود ضمن الحد.
 * - أقل من الحد ← رفع التعليق عن الأقدم أولاً حتى يمتلئ الحد.
 * لا يعيد ترتيب من بدّلهم المالك يدوياً: يعلّق فقط عند التجاوز ويرفع فقط عند وجود مكان.
 */
export async function enforceMemberLimit(db: Db, ownerId: string): Promise<{ suspended: string[]; restored: string[] }> {
  const limit = (await ownerMemberLimit(db, ownerId)) ?? 0;
  // ترتيب المستخدمين حسب أقدم انضمام/دعوة عند هذا المالك
  const users: Array<{ userId: string; since: Date; active: boolean }> = await db.query(
    `SELECT m."userId",
            MIN(COALESCE(m."joinedAt", m."createdAt")) AS since,
            BOOL_OR(NOT m."suspendedByPlan") AS active
       FROM store_members m JOIN stores s ON s.id = m."storeId"
      WHERE s."userId"::text = $1 AND m.status IN ('accepted', 'pending')
      GROUP BY m."userId"
      ORDER BY since ASC`,
    [ownerId],
  );
  const active = users.filter((u) => u.active);
  const suspendedUsers = users.filter((u) => !u.active);
  const toSuspend = active.length > limit ? active.slice(limit).map((u) => u.userId) : [];
  const room = Math.max(0, limit - active.length);
  const toRestore = room > 0 ? suspendedUsers.slice(0, room).map((u) => u.userId) : [];

  if (toSuspend.length) await setSuspended(db, ownerId, toSuspend, true);
  if (toRestore.length) await setSuspended(db, ownerId, toRestore, false);
  return { suspended: toSuspend, restored: toRestore };
}

export async function setSuspended(db: Db, ownerId: string, userIds: string[], suspended: boolean) {
  if (!userIds.length) return;
  await db.query(
    `UPDATE store_members m SET "suspendedByPlan" = $3
       FROM stores s
      WHERE s.id = m."storeId" AND s."userId"::text = $1 AND m."userId" = ANY($2::uuid[])`,
    [ownerId, userIds, suspended],
  );
}

/** لا يرمي أبداً — يُستدعى بعد تغييرات الخطة دون أن يفشل العملية الأصلية */
export function enforceMemberLimitSafe(db: Db, ownerId: string) {
  return enforceMemberLimit(db, ownerId).catch((err) => {
    console.error('[team] enforceMemberLimit failed', ownerId, err?.message);
  });
}
