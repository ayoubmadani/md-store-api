import { NotFoundException } from '@nestjs/common';
import { InventoryService } from './inventory.service';

// البحث بالباركود: منتج بسيط، أو نسخة بعينها (مقاس/لون)
function setup(rows: { products?: any[]; variants?: any[] }) {
  const ds = {
    query: jest.fn(async (sql: string, _params?: unknown[]) => {
      if (/FROM variant_details v/.test(sql)) return rows.variants ?? [];
      if (/FROM products p/.test(sql)) return rows.products ?? [];
      return [];
    }),
  };
  return { svc: new InventoryService(ds as any), ds };
}

describe('InventoryService.findByBarcode', () => {
  it('finds a simple product', async () => {
    const { svc } = setup({ products: [{ id: 'p1', name: 'Mug', stock: 4, price: 900, image: null, lowStockThreshold: 5 }] });
    expect(await svc.findByBarcode('s1', ' 6111234567890 ')).toMatchObject({ product: { id: 'p1', name: 'Mug', stock: 4 }, variant: null });
  });

  it('a variant barcode returns the product and that variant', async () => {
    const { svc } = setup({
      variants: [{ id: 'v1', productId: 'p2', stock: 7, name: [{ displayMode: 'text', value: 'M', attrName: 'Size' }], productName: 'Set', productPrice: 2500, image: null, lowStockThreshold: 5 }],
    });
    const r = await svc.findByBarcode('s1', '123');
    expect(r.product).toMatchObject({ id: 'p2', name: 'Set' });
    expect(r.variant).toMatchObject({ id: 'v1', stock: 7, parts: [{ mode: 'text', value: 'M', attr: 'Size' }] });
  });

  it('unknown barcode → 404 (the app offers to create a product)', async () => {
    const { svc } = setup({});
    await expect(svc.findByBarcode('s1', '999')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('searches only inside the given store', async () => {
    const { svc, ds } = setup({});
    await svc.findByBarcode('s1', '999').catch(() => undefined);
    for (const [sql, params] of ds.query.mock.calls as [string, unknown[]][]) {
      expect(sql).toMatch(/"storeId"::text = \$1/);
      expect(params[0]).toBe('s1');
    }
  });
});
