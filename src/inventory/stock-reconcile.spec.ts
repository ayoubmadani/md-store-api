import { StatusEnum } from '../order/entities/order.entity';
import { orderStockDiff, holdsStock } from './stock-reconcile';

const item = (over: any = {}) => ({ productId: 'p1', variantDetailId: null, quantity: 1, offer: null, ...over });

describe('holdsStock', () => {
  it('confirmed, shipping and delivered hold stock; everything else does not', () => {
    for (const s of [StatusEnum.CONFIRMED, StatusEnum.SHIPPING, StatusEnum.DELIVERED]) expect(holdsStock(s)).toBe(true);
    for (const s of [StatusEnum.PENDING, StatusEnum.APPL1, StatusEnum.POSTPONED, StatusEnum.CANCELLED, StatusEnum.RETURNED]) expect(holdsStock(s)).toBe(false);
  });
});

describe('orderStockDiff', () => {
  it('confirming deducts units (quantity × offer pieces), per variant', () => {
    const diff = orderStockDiff(StatusEnum.CONFIRMED, [
      item({ quantity: 2 }),
      item({ productId: 'p2', variantDetailId: 'v9', quantity: 1, offer: { quantity: 3 } }),
    ], []);
    expect(diff).toEqual([
      { productId: 'p1', variantDetailId: null, delta: -2 },
      { productId: 'p2', variantDetailId: 'v9', delta: -3 },
    ]);
  });

  it('already deducted → nothing to do (idempotent)', () => {
    expect(orderStockDiff(StatusEnum.SHIPPING, [item({ quantity: 2 })], [{ productId: 'p1', variantDetailId: null, delta: -2 }])).toEqual([]);
  });

  it('cancelled or returned after confirmation gives the stock back', () => {
    const recorded = [{ productId: 'p1', variantDetailId: null, delta: -2 }];
    expect(orderStockDiff(StatusEnum.RETURNED, [item({ quantity: 2 })], recorded)).toEqual([{ productId: 'p1', variantDetailId: null, delta: 2 }]);
    expect(orderStockDiff(StatusEnum.CANCELLED, [item({ quantity: 2 })], recorded)).toEqual([{ productId: 'p1', variantDetailId: null, delta: 2 }]);
  });

  it('items edited after confirmation: only the difference is applied', () => {
    const recorded = [{ productId: 'p1', variantDetailId: null, delta: -2 }];
    const diff = orderStockDiff(StatusEnum.CONFIRMED, [item({ quantity: 3 }), item({ productId: 'p3' })], recorded);
    expect(diff).toEqual([
      { productId: 'p1', variantDetailId: null, delta: -1 },
      { productId: 'p3', variantDetailId: null, delta: -1 },
    ]);
  });

  it('a removed item is restored', () => {
    const recorded = [{ productId: 'p1', variantDetailId: null, delta: -2 }, { productId: 'p2', variantDetailId: null, delta: -1 }];
    expect(orderStockDiff(StatusEnum.CONFIRMED, [item({ quantity: 2 })], recorded)).toEqual([{ productId: 'p2', variantDetailId: null, delta: 1 }]);
  });

  it('pending order with nothing recorded → nothing', () => {
    expect(orderStockDiff(StatusEnum.PENDING, [item()], [])).toEqual([]);
  });
});
