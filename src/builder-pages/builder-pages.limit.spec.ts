import { BadRequestException } from '@nestjs/common';
import { BuilderPagesService } from './builder-pages.service';

// حد الخطة لصفحات الهبوط (landingPageNumber) يُطبَّق على محرر الصفحات أيضاً
function setup(limit: number | null, existing: number, pageActive = true) {
  const builderPageRepo = {
    findOne: jest.fn().mockResolvedValue({ id: 'p1', name: 'P', storeId: 's1', tree: [], isActive: pageActive }),
    create: jest.fn((d: any) => d),
    save: jest.fn(async (d: any) => ({ id: 'new', ...d })),
    manager: {
      query: jest.fn(async (sql: string) => (/plan_features/.test(sql) ? (limit == null ? [] : [{ limit }]) : [{ count: existing }])),
    },
  };
  const storeRepo = { findOne: jest.fn().mockResolvedValue({ id: 's1' }) };
  const svc = new BuilderPagesService(builderPageRepo as any, {} as any, {} as any, {} as any, storeRepo as any, {} as any, {} as any, {} as any, {} as any);
  return { svc, builderPageRepo };
}

describe('BuilderPagesService landing page limit', () => {
  it('blocks creating when the plan limit is reached (0 = none allowed)', async () => {
    const { svc, builderPageRepo } = setup(0, 0);
    await expect(svc.create({ name: 'x', storeId: 's1' } as any, 'u1')).rejects.toBeInstanceOf(BadRequestException);
    expect(builderPageRepo.save).not.toHaveBeenCalled();
  });

  it('allows creating under the limit', async () => {
    const { svc } = setup(5, 4);
    await expect(svc.create({ name: 'x', storeId: 's1' } as any, 'u1')).resolves.toMatchObject({ id: 'new' });
  });

  it('no active subscription → limit 0', async () => {
    const { svc } = setup(null, 0);
    await expect(svc.create({ name: 'x', storeId: 's1' } as any, 'u1')).rejects.toThrow('صفحات الهبوط');
  });

  it('duplicate also counts against the limit', async () => {
    const { svc, builderPageRepo } = setup(3, 3);
    await expect(svc.duplicate('p1', 'u1')).rejects.toBeInstanceOf(BadRequestException);
    expect(builderPageRepo.save).not.toHaveBeenCalled();
  });
});

it('counts the user pages across all stores with SQL (builder_pages has no store relation)', async () => {
  const { svc, builderPageRepo } = setup(10, 1);
  await svc.create({ name: 'x', storeId: 's1' } as any, 'u1');
  const sqls = builderPageRepo.manager.query.mock.calls.map((c: any[]) => c[0]);
  expect(sqls.some((q: string) => /FROM builder_pages WHERE "isActive" = true AND "storeId" IN \(SELECT id::text FROM stores WHERE "userId"/.test(q))).toBe(true);
});

describe('toggleStatus and the limit', () => {
  it('activating a page is blocked when active pages reached the limit', async () => {
    const { svc, builderPageRepo } = setup(2, 2, false);
    await expect(svc.toggleStatus('p1', 'u1')).rejects.toBeInstanceOf(BadRequestException);
    expect(builderPageRepo.save).not.toHaveBeenCalled();
  });

  it('deactivating is always allowed, even over the limit', async () => {
    const { svc } = setup(0, 9, true);
    await expect(svc.toggleStatus('p1', 'u1')).resolves.toEqual({ isActive: false });
  });

  it('activating under the limit works', async () => {
    const { svc } = setup(3, 2, false);
    await expect(svc.toggleStatus('p1', 'u1')).resolves.toEqual({ isActive: true });
  });
});
