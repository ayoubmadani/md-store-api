import { NotFoundException } from '@nestjs/common';
import { OrdersService } from './order.service';

// مسح باركود طلب: الباركود الداخلي (O…) أو رقم تتبع شركة التوصيل — داخل المتجر فقط
function setup(rows: any[]) {
  const ordersRepo = { query: jest.fn(async () => rows) };
  const svc = new (OrdersService as any)(ordersRepo, null, null, null, null, null, null, null);
  return { svc: svc as OrdersService, ordersRepo };
}

describe('OrdersService.findByCode', () => {
  it('returns the order id for an internal barcode or a tracking number', async () => {
    const { svc } = setup([{ id: 'o1' }]);
    expect(await svc.findByCode('s1', ' o100523 ')).toEqual({ id: 'o1' });
  });

  it('searches both codes, case-insensitively, inside the store only', async () => {
    const { svc, ordersRepo } = setup([{ id: 'o1' }]);
    await svc.findByCode('s1', 'yal-ABC123');
    const [sql, params] = ordersRepo.query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toMatch(/"storeId"::text = \$1/);
    expect(sql).toMatch(/upper\(o\.barcode\) = \$2/i);
    expect(sql).toMatch(/upper\(o\."shippingTrackingId"\) = \$2/i);
    expect(params).toEqual(['s1', 'YAL-ABC123']);
  });

  it('unknown code → 404', async () => {
    const { svc } = setup([]);
    await expect(svc.findByCode('s1', 'O1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
