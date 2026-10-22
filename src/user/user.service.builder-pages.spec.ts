import { UserService } from './user.service';

// حدود الخطة: صفحات محرر الصفحات المفعّلة فوق الحد تُطفأ كلها (مثل المتاجر)
function setup(activeBuilderPages: number, limit: number) {
  const sqls: string[] = [];
  const qb = () => ({ update: () => ({ set: () => ({ where: () => ({ andWhere: () => ({ execute: async () => ({}) }), execute: async () => ({}) }) }) }) });
  const repo = { count: jest.fn().mockResolvedValue(0), createQueryBuilder: qb };
  const storeRepo = {
    ...repo,
    manager: {
      query: jest.fn(async (sql: string) => {
        sqls.push(sql);
        return /count\(\*\)/.test(sql) ? [{ count: activeBuilderPages }] : [];
      }),
    },
  };
  const sub = { planId: 'pl', plan: { features: { storeNumber: 9, productNumber: 9, pixelFacebookNumber: 9, pixelTiktokNumber: 9, landingPageNumber: limit } } };
  const subscriptionService = { findSub: jest.fn().mockResolvedValue(sub), revertUnauthorizedThemes: jest.fn() };
  const svc = new UserService(repo as any, storeRepo as any, repo as any, repo as any, repo as any, repo as any, repo as any, repo as any, repo as any, {} as any, {} as any, subscriptionService as any);
  return { svc, sqls };
}

describe('UserService.initSub builder pages', () => {
  it('turns off all builder pages when active pages exceed the plan limit', async () => {
    const { svc, sqls } = setup(15, 0);
    await svc.initSub('u1');
    expect(sqls.some((q) => /UPDATE builder_pages SET "isActive" = false WHERE "storeId" IN \(SELECT id::text FROM stores WHERE "userId"::text = \$1\)/.test(q))).toBe(true);
  });

  it('leaves pages on when within the limit', async () => {
    const { svc, sqls } = setup(3, 5);
    await svc.initSub('u1');
    expect(sqls.some((q) => /UPDATE builder_pages/.test(q))).toBe(false);
  });
});
