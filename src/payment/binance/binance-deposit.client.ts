import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';

export type BinanceDeposit = { txId: string; coin: string; status: number; network: string; amount: string; insertTime: number };

// سجل إيداعات USDT في حساب Binance الخاص بالمنصة (مفتاح قراءة فقط).
// Binance يحظر طلبات الولايات المتحدة (451) — الـ API يجب أن يعمل من منطقة أوروبية (fra1).
@Injectable()
export class BinanceDepositClient {
  constructor(private readonly config: ConfigService) { }

  async listUsdtDeposits(startTime: number): Promise<BinanceDeposit[]> {
    const key = this.config.get<string>('BINANCE_API_KEY');
    const secret = this.config.get<string>('BINANCE_SECRET');
    if (!key || !secret) throw new BadGatewayException('الدفع بـ Binance غير مهيأ (BINANCE_API_KEY / BINANCE_SECRET)');
    const qs = `coin=USDT&startTime=${startTime}&limit=1000&recvWindow=10000&timestamp=${Date.now()}`;
    const signature = createHmac('sha256', secret).update(qs).digest('hex');
    const res = await fetch(`https://api.binance.com/sapi/v1/capital/deposit/hisrec?${qs}&signature=${signature}`, {
      headers: { 'X-MBX-APIKEY': key },
      signal: AbortSignal.timeout(15_000),
    }).catch(() => null);
    if (!res) throw new BadGatewayException('تعذّر الاتصال بـ Binance، حاول بعد قليل');
    if (res.status === 451) throw new BadGatewayException('Binance يرفض الطلب من منطقة الخادم (451) — يجب تشغيل الـ API في أوروبا');
    const body = await res.json().catch(() => null);
    if (!res.ok || !Array.isArray(body)) throw new BadGatewayException(`خطأ من Binance${body?.msg ? `: ${body.msg}` : ''}`);
    return body as BinanceDeposit[];
  }
}
