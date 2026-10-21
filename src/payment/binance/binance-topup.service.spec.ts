import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { BinanceTopupService, uniqueUsdtAmount } from './binance-topup.service';

const settings = {
  getAll: jest.fn().mockResolvedValue({
    binanceEnabled: true,
    usdtRateDzd: 250,
    binanceTrc20Address: 'TXyz1234567890123456789012345678901',
    binanceBep20Address: '0x' + 'a'.repeat(40),
  }),
};

function setup(deposits: any[] = []) {
  const rows: any[] = [];
  const repo = {
    find: jest.fn(async () => rows.filter((r) => r.status === 'pending')),
    findOne: jest.fn(async ({ where }: any) => rows.find((r) => r.id === where.id) ?? null),
    create: jest.fn((d: any) => ({ ...d })),
    save: jest.fn(async (d: any) => {
      const i = rows.findIndex((r) => r.id === d.id);
      if (i >= 0) rows[i] = { ...rows[i], ...d };
      else rows.push({ id: `req${rows.length + 1}`, createdAt: new Date(), ...d });
      return rows.find((r) => r.id === (d.id ?? `req${rows.length}`)) ?? rows[rows.length - 1];
    }),
  };
  const binance = { listUsdtDeposits: jest.fn().mockResolvedValue(deposits) };
  const credited: any[] = [];
  const payment = {
    handleWalletBalance: jest.fn(async (userId: string, amount: number, _a: string, _t: string, _m: unknown, providerId: string) => {
      if (credited.some((c) => c.providerId === providerId)) return { success: true, message: 'Transaction already processed' };
      credited.push({ userId, amount, providerId });
      return { success: true, newBalance: amount };
    }),
  };
  const dataSource = { transaction: (fn: any) => fn({ save: (_e: unknown, d: any) => repo.save(d) }) };
  const svc = new BinanceTopupService(repo as any, binance as any, payment as any, settings as any, dataSource as any);
  return { svc, rows, binance, payment, credited };
}

const dep = (over: any = {}) => ({ txId: 'TX1', coin: 'USDT', status: 1, network: 'TRX', amount: '10.0371', insertTime: Date.now(), transferType: 1, ...over });

describe('uniqueUsdtAmount', () => {
  it('adds a 4-decimal suffix that no other pending request uses', () => {
    const taken = new Set(['10.0001', '10.0002']);
    const a = uniqueUsdtAmount(10, taken, () => 0); // 0 → suffix 0.0001 (taken) → next free
    expect(a).toBe('10.0003');
  });
});

describe('BinanceTopupService.createRequest', () => {
  it('converts DZD with the admin rate and returns a unique amount and addresses', async () => {
    const { svc } = setup();
    const r = await svc.createRequest('u1', 2500);
    expect(Number(r.amountUsdt)).toBeGreaterThan(10);
    expect(Number(r.amountUsdt)).toBeLessThan(10.01);
    expect(r.amountUsdt).toMatch(/^10\.\d{4}$/);
    expect(r.addresses).toEqual({ TRX: expect.any(String), BSC: expect.any(String) });
  });

  it('refuses when disabled or amount out of range', async () => {
    const { svc } = setup();
    await expect(svc.createRequest('u1', 100)).rejects.toBeInstanceOf(BadRequestException);
    settings.getAll.mockResolvedValueOnce({ binanceEnabled: false, usdtRateDzd: 250, binanceTrc20Address: '', binanceBep20Address: '' });
    await expect(svc.createRequest('u1', 2500)).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('BinanceTopupService.confirm', () => {
  async function pending(deposits: any[]) {
    const ctx = setup(deposits);
    const r = await ctx.svc.createRequest('u1', 2500);
    ctx.binance.listUsdtDeposits.mockResolvedValue(deposits.map((d) => ({ ...d, amount: d.amount ?? r.amountUsdt })));
    return { ...ctx, r };
  }

  it('credits the wallet in DZD when the deposit matches exactly', async () => {
    const { svc, r, credited, rows } = await pending([dep({ amount: undefined })]);
    const res = await svc.confirm('u1', r.id, ' TX1 ');
    expect(res.status).toBe('paid');
    expect(credited).toEqual([{ userId: 'u1', amount: 2500, providerId: 'binance:TX1' }]);
    expect(rows[0]).toMatchObject({ status: 'paid', txId: 'TX1', network: 'TRX' });
  });

  it('another merchant cannot use the request', async () => {
    const { svc, r } = await pending([dep({ amount: undefined })]);
    await expect(svc.confirm('u2', r.id, 'TX1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a copied txId whose amount is not this request (front-running)', async () => {
    const { svc, r, credited } = await pending([dep({ amount: '10.0099' })]);
    await expect(svc.confirm('u1', r.id, 'TX1')).rejects.toThrow('المبلغ');
    expect(credited).toHaveLength(0);
  });

  it('rejects wrong network, pending status, or a deposit older than the request', async () => {
    for (const bad of [{ network: 'ETH' }, { status: 0 }, { insertTime: Date.now() - 3 * 3600_000 }]) {
      const { svc, r } = await pending([dep({ amount: undefined, ...bad })]);
      await expect(svc.confirm('u1', r.id, 'TX1')).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('the same txId cannot pay a second request', async () => {
    const { svc, r, payment } = await pending([dep({ amount: undefined })]);
    payment.handleWalletBalance.mockResolvedValueOnce({ success: true, message: 'Transaction already processed' });
    await expect(svc.confirm('u1', r.id, 'TX1')).rejects.toThrow('استُعملت');
  });

  it('only Binance-to-Binance (internal) transfers are accepted for now', async () => {
    const { svc, r, credited } = await pending([dep({ amount: undefined, transferType: 0 })]);
    await expect(svc.confirm('u1', r.id, 'TX1')).rejects.toThrow('Binance');
    expect(credited).toHaveLength(0);
  });

  it('internal transfer id accepted with or without the "Off-chain transfer" prefix', async () => {
    for (const pasted of ['Off-chain transfer 98765', '98765']) {
      const { svc, r, credited } = await pending([dep({ amount: undefined, txId: 'Off-chain transfer 98765' })]);
      await svc.confirm('u1', r.id, pasted);
      expect(credited[0].providerId).toBe('binance:Off-chain transfer 98765');
    }
  });

  it('unknown txId → not found yet', async () => {
    const { svc, r } = await pending([]);
    await expect(svc.confirm('u1', r.id, 'NOPE')).rejects.toThrow('غير موجودة');
  });
});
