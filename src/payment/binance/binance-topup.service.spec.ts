import { BadRequestException, ForbiddenException, HttpException } from '@nestjs/common';
import { BinanceTopupService } from './binance-topup.service';

const settings = {
  getAll: jest.fn().mockResolvedValue({
    binanceEnabled: true,
    usdtRateDzd: 260,
    binanceTrc20Address: 'TXyz1234567890123456789012345678901',
    binanceBep20Address: '0x' + 'a'.repeat(40),
  }),
};

function setup(deposits: any[] = [], failedLastHour = 0) {
  const rows: any[] = [];
  const repo = {
    count: jest.fn(async () => failedLastHour),
    save: jest.fn(async (d: any) => { rows.push(d); return d; }),
    create: jest.fn((d: any) => ({ ...d })),
  };
  const binance = { listUsdtDeposits: jest.fn().mockResolvedValue(deposits) };
  const credited: any[] = [];
  const payment = {
    handleWalletBalance: jest.fn(async (userId: string, amount: number, _a: string, _t: string, _m: unknown, providerId: string) => {
      if (credited.some((c) => c.providerId === providerId)) return { success: true, message: 'Transaction already processed' };
      credited.push({ userId, amount, providerId });
      return { success: true };
    }),
  };
  const dataSource = { transaction: (fn: any) => fn({ save: (_e: unknown, d: any) => repo.save(d) }) };
  const svc = new BinanceTopupService(repo as any, binance as any, payment as any, settings as any, dataSource as any);
  return { svc, rows, binance, payment, credited, repo };
}

const dep = (over: any = {}) => ({ txId: 'Off-chain transfer 98765', coin: 'USDT', status: 1, network: 'TRX', amount: '10', insertTime: Date.now(), transferType: 1, ...over });

describe('BinanceTopupService.publicConfig', () => {
  it('returns rate and addresses when enabled', async () => {
    const { svc } = setup();
    expect(await svc.publicConfig()).toMatchObject({ enabled: true, rate: 260, addresses: { TRX: expect.any(String), BSC: expect.any(String) } });
  });
});

describe('BinanceTopupService.claim (transfer code only)', () => {
  it('credits received USDT × admin rate in DZD', async () => {
    const { svc, credited, rows } = setup([dep()]);
    const res = await svc.claim('u1', '98765');
    expect(res).toEqual({ status: 'paid', amountDzd: 2600, amountUsdt: 10 });
    expect(credited).toEqual([{ userId: 'u1', amount: 2600, providerId: 'binance:Off-chain transfer 98765' }]);
    expect(rows.at(-1)).toMatchObject({ userId: 'u1', status: 'paid', txId: 'Off-chain transfer 98765', amountUsdt: '10.0000' });
  });

  it('full "Off-chain transfer" text works too', async () => {
    const { svc, credited } = setup([dep()]);
    await svc.claim('u1', 'Off-chain transfer 98765');
    expect(credited).toHaveLength(1);
  });

  it('the same code cannot be used twice', async () => {
    const { svc, payment } = setup([dep()]);
    payment.handleWalletBalance.mockResolvedValueOnce({ success: true, message: 'Transaction already processed' });
    await expect(svc.claim('u1', '98765')).rejects.toThrow('استُعمل');
  });

  it('external (on-chain) transfers and wrong coin/status are rejected and counted as failures', async () => {
    for (const bad of [{ transferType: 0 }, { coin: 'BTC' }, { status: 0 }]) {
      const { svc, credited, rows } = setup([dep(bad)]);
      await expect(svc.claim('u1', '98765')).rejects.toBeInstanceOf(BadRequestException);
      expect(credited).toHaveLength(0);
      expect(rows.at(-1)).toMatchObject({ status: 'failed' });
    }
  });

  it('unknown code → not found, recorded as a failed attempt', async () => {
    const { svc, rows } = setup([]);
    await expect(svc.claim('u1', '111')).rejects.toThrow('غير موجود');
    expect(rows.at(-1)).toMatchObject({ userId: 'u1', status: 'failed' });
  });

  it('5 failed attempts in an hour → blocked before calling Binance (guessing protection)', async () => {
    const { svc, binance } = setup([dep()], 5);
    await expect(svc.claim('u1', '98765')).rejects.toBeInstanceOf(HttpException);
    expect(binance.listUsdtDeposits).not.toHaveBeenCalled();
  });

  it('disabled → forbidden', async () => {
    const { svc } = setup([dep()]);
    settings.getAll.mockResolvedValueOnce({ binanceEnabled: false, usdtRateDzd: 260, binanceTrc20Address: '', binanceBep20Address: '' });
    await expect(svc.claim('u1', '98765')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
