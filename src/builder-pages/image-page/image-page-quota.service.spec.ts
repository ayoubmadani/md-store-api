import { BadRequestException } from '@nestjs/common';
import { ImagePageQuotaService } from './image-page-quota.service';

// قاعدة بيانات وهمية: transaction متسلسلة (مثل pg_advisory_xact_lock لنفس التاجر)
function fakeDs(limit: number | null, existing = 0) {
  const rows: any[] = Array.from({ length: existing }, (_, i) => ({ id: `old${i}`, userId: 'u1' }));
  const sql: string[] = [];
  let chain: Promise<unknown> = Promise.resolve();
  const m = {
    query: async (q: string, p: any[]) => {
      sql.push(q);
      if (/pg_advisory_xact_lock/.test(q)) return [];
      if (/plan_features/.test(q)) return limit == null ? [] : [{ limit }];
      if (/count\(\*\)/.test(q)) return [{ count: rows.filter((r) => r.userId === p[0]).length }];
      return [];
    },
    create: (_e: unknown, d: any) => ({ ...d }),
    save: async (_e: unknown, d: any) => {
      const r = { id: `n${rows.length}`, ...d };
      rows.push(r);
      return r;
    },
  };
  const ds = {
    manager: m,
    transaction: (fn: (mm: typeof m) => Promise<unknown>) => {
      const r = chain.then(() => fn(m));
      chain = r.catch(() => undefined);
      return r;
    },
    getRepository: () => ({
      delete: async (id: string) => {
        const i = rows.findIndex((r) => r.id === id);
        if (i >= 0) rows.splice(i, 1);
      },
    }),
  };
  return { svc: new ImagePageQuotaService(ds as any), rows, sql };
}
const meta = { storeId: 's1', builderPageId: 'p1', language: 'ar' as const, style: 'فاخر' };

describe('ImagePageQuotaService', () => {
  it('usage returns 0/limit for a new user', async () => {
    expect(await fakeDs(5).svc.usage('u1')).toEqual({ used: 0, limit: 5 });
    expect(await fakeDs(null).svc.usage('u1')).toEqual({ used: 0, limit: 0 }); // بلا اشتراك
  });

  it('counts the month in Algiers time', async () => {
    const { svc, sql } = fakeDs(5);
    await svc.usage('u1');
    expect(sql.find((q) => /count\(\*\)/.test(q))).toContain("date_trunc('month', now() AT TIME ZONE 'Africa/Algiers')");
  });

  it('consume throws at limit and does not call run', async () => {
    const { svc } = fakeDs(2, 2);
    const run = jest.fn();
    await expect(svc.consume('u1', meta, run)).rejects.toBeInstanceOf(BadRequestException);
    expect(run).not.toHaveBeenCalled();
  });

  it('consume does not insert when run throws', async () => {
    const { svc, rows } = fakeDs(3);
    await expect(svc.consume('u1', meta, async () => { throw new Error('claude'); })).rejects.toThrow('claude');
    expect(rows).toHaveLength(0);
  });

  it('consume inserts one row on success', async () => {
    const { svc, rows, sql } = fakeDs(3);
    expect(await svc.consume('u1', meta, async () => 'ok')).toBe('ok');
    expect(rows).toEqual([expect.objectContaining({ userId: 'u1', storeId: 's1', builderPageId: 'p1', language: 'ar', style: 'فاخر' })]);
    expect(sql.some((q) => /pg_advisory_xact_lock\(hashtext\(\$1\)\)/.test(q))).toBe(true);
  });

  it('concurrent at limit: exactly one resolves', async () => {
    const { svc, rows } = fakeDs(2, 1);
    const slow = () => new Promise((r) => setTimeout(() => r('ok'), 10));
    const res = await Promise.allSettled([svc.consume('u1', meta, slow), svc.consume('u1', meta, slow)]);
    expect(res.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((res.find((r) => r.status === 'rejected') as PromiseRejectedResult).reason).toBeInstanceOf(BadRequestException);
    expect(rows).toHaveLength(2);
  });
});
