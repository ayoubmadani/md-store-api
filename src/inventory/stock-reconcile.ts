import { StatusEnum } from '../order/entities/order.entity';

// الطلب «يحجز» المخزون من التأكيد حتى التسليم؛ الإلغاء والإرجاع يعيدانه
const HOLDING = new Set<StatusEnum>([StatusEnum.CONFIRMED, StatusEnum.SHIPPING, StatusEnum.DELIVERED]);

export const holdsStock = (status: StatusEnum) => HOLDING.has(status);

export type StockItem = { productId: string; variantDetailId?: string | null; quantity: number; offer?: { quantity?: number } | null };
export type StockLine = { productId: string; variantDetailId: string | null; delta: number };

const key = (productId: string, variantId?: string | null) => `${productId}|${variantId || ''}`;

/**
 * المطابقة: ما يجب أن يكون محجوزاً للطلب الآن − ما سُجّل له فعلاً = الفرق الذي يُطبَّق.
 * لا يُنقص مرتين مهما تغيّرت الحالة أو عُدّلت عناصر الطلب.
 * الكمية = عدد العناصر × قطع العرض (عرض «قطعتان» = 2).
 */
export function orderStockDiff(status: StatusEnum, items: StockItem[], recorded: StockLine[]): StockLine[] {
  const target = new Map<string, StockLine>();
  if (holdsStock(status)) {
    for (const it of items) {
      const units = Math.max(0, Number(it.quantity) || 0) * Math.max(1, Number(it.offer?.quantity) || 1);
      const k = key(it.productId, it.variantDetailId);
      const line = target.get(k) ?? { productId: it.productId, variantDetailId: it.variantDetailId || null, delta: 0 };
      line.delta -= units;
      target.set(k, line);
    }
  }
  const current = new Map<string, StockLine>();
  for (const r of recorded) {
    const k = key(r.productId, r.variantDetailId);
    const line = current.get(k) ?? { productId: r.productId, variantDetailId: r.variantDetailId || null, delta: 0 };
    line.delta += Number(r.delta) || 0;
    current.set(k, line);
  }
  const out: StockLine[] = [];
  for (const k of new Set([...target.keys(), ...current.keys()])) {
    const t = target.get(k);
    const c = current.get(k);
    const delta = (t?.delta ?? 0) - (c?.delta ?? 0);
    if (delta) out.push({ productId: (t ?? c)!.productId, variantDetailId: (t ?? c)!.variantDetailId, delta });
  }
  return out;
}
