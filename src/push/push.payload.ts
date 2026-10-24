// نص إشعار «طلب جديد» على الهاتف — الضغط يفتح الطلب في تطبيق الهاتف

export type PushPayload = { title: string; body: string; url: string; tag: string };

const money = (n: number) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });

export function newOrderPayload(
  order: { id: string; customerName?: string; totalPrice?: number; priceShip?: number; isDigital?: boolean; customerWilaya?: { ar_name?: string } | null; items?: { quantity?: number; product?: { name?: string } | null }[] },
  storeName: string,
): PushPayload {
  const items = order.items ?? [];
  const first = items[0];
  const what = first ? `${first.quantity ?? 1}× ${first.product?.name ?? ''}${items.length > 1 ? ` +${items.length - 1}` : ''}` : '';
  const total = Number(order.totalPrice || 0) + (order.isDigital ? 0 : Number(order.priceShip || 0));
  const parts = [order.customerName?.trim(), what, `${money(total)} DA`, order.customerWilaya?.ar_name].filter(Boolean);
  return { title: `🛒 طلب جديد — ${storeName}`, body: parts.join(' · '), url: `/orders/${order.id}`, tag: `order-${order.id}` };
}
