import { newOrderPayload } from './push.payload';
import { PushService } from './push.service';

describe('newOrderPayload', () => {
  it('title, customer, first product, total with delivery and wilaya; tap opens the order', () => {
    const p = newOrderPayload({
      id: 'o1', barcode: 'O100523', customerName: 'محمد بن علي', totalPrice: 7000, priceShip: 600, isDigital: false,
      customerWilaya: { ar_name: 'الجزائر' }, items: [{ quantity: 2, product: { name: 'طقم صيفي' } }, { quantity: 1, product: { name: 'حقيبة' } }],
    } as any, 'متجر بيبي');
    expect(p.title).toBe('🛒 طلب جديد — متجر بيبي');
    expect(p.body).toBe('محمد بن علي · 2× طقم صيفي +1 · 7,600 DA · الجزائر');
    expect(p.url).toBe('/orders/o1');
    expect(p.tag).toBe('order-o1');
  });
});

describe('PushService.sendToUsers', () => {
  function setup(subs: any[], fail: Record<string, number> = {}) {
    const ds = { query: jest.fn(async (sql: string) => (/FROM push_subscriptions/.test(sql) ? subs : [])) };
    const svc = new PushService(ds as any);
    const sent: string[] = [];
    (svc as any).vapid = async () => ({ publicKey: 'pub', privateKey: 'priv' });
    (svc as any).deliver = jest.fn(async (sub: any) => {
      if (fail[sub.endpoint]) throw Object.assign(new Error('gone'), { statusCode: fail[sub.endpoint] });
      sent.push(sub.endpoint);
    });
    return { svc, ds, sent };
  }

  it('sends to every subscription of the users', async () => {
    const { svc, sent } = setup([{ id: 's1', endpoint: 'e1', p256dh: 'k', auth: 'a' }, { id: 's2', endpoint: 'e2', p256dh: 'k', auth: 'a' }]);
    await svc.sendToUsers(['u1'], { title: 't', body: 'b', url: '/', tag: 'x' });
    expect(sent).toEqual(['e1', 'e2']);
  });

  it('removes subscriptions the push service says are gone (404/410), keeps others', async () => {
    const { svc, ds } = setup([{ id: 's1', endpoint: 'e1' }, { id: 's2', endpoint: 'e2' }, { id: 's3', endpoint: 'e3' }], { e1: 410, e2: 500 });
    await svc.sendToUsers(['u1'], { title: 't', body: 'b', url: '/', tag: 'x' });
    const del = (ds.query.mock.calls as any[]).find(([sql]) => /DELETE FROM push_subscriptions/.test(sql));
    expect(del[1]).toEqual([['s1']]);
  });

  it('no users → no query, nothing sent', async () => {
    const { svc, ds } = setup([]);
    await svc.sendToUsers([], { title: 't', body: 'b', url: '/', tag: 'x' });
    expect(ds.query).not.toHaveBeenCalled();
  });
});
