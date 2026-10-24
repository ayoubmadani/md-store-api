import { InventoryService } from './inventory.service';

// قائمة المخزون: منتجات المتجر المختار فقط، بدون المحذوفة (سلة المحذوفات)
describe('InventoryService.overview', () => {
  it('lists only live products of the given store', async () => {
    const ds = { query: jest.fn(async () => []) };
    await new InventoryService(ds as any).overview('s1');
    const [sql, params] = ds.query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toMatch(/"storeId"::text = \$1/);
    expect(sql).toMatch(/"deletedAt" IS NULL/);
    expect(params).toEqual(['s1']);
  });
});
