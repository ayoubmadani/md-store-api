import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';

// transferType: 1 = تحويل داخلي من حساب Binance آخر (مجاني وفوري)، 0 = من الشبكة الخارجية
// سجل Binance Pay (إرسال إلى UID): amount موجب = استلام، سالب = إرسال
// orderId = الرقم الذي يراه المرسل في التطبيق «Order ID»؛ transactionId = معرّف Binance الداخلي (P_…)
export type BinancePayTx = { transactionId: string; orderId?: string; amount: string; currency: string; orderType: string; transactionTime: number };

export type BinanceDeposit = { txId: string; coin: string; status: number; network: string; amount: string; insertTime: number; transferType?: number };

// سجل إيداعات USDT في حساب Binance الخاص بالمنصة (مفتاح قراءة فقط).
// Binance يحظر طلبات الولايات المتحدة (451) — الـ API يجب أن يعمل من منطقة أوروبية (fra1).
@Injectable()
export class BinanceDepositClient {
  constructor(private readonly config: ConfigService) { }

  async listUsdtDeposits(startTime: number): Promise<BinanceDeposit[]> {
    const body = await this.signedGet('/sapi/v1/capital/deposit/hisrec', `coin=USDT&startTime=${startTime}&limit=1000`);
    if (!Array.isArray(body)) throw new BadGatewayException('رد غير متوقع من Binance');
    return body as BinanceDeposit[];
  }

  async listPayTransactions(startTime: number): Promise<BinancePayTx[]> {
    const body = await this.signedGet('/sapi/v1/pay/transactions', `startTime=${startTime}&limit=100`);
    if (!Array.isArray(body?.data)) throw new BadGatewayException('رد غير متوقع من Binance Pay');
    return body.data as BinancePayTx[];
  }

  private async signedGet(path: string, params: string): Promise<any> {
    const key = this.config.get<string>('BINANCE_API_KEY');
    const secret = this.config.get<string>('BINANCE_SECRET');
    if (!key || !secret) throw new BadGatewayException('الدفع بـ Binance غير مهيأ (BINANCE_API_KEY / BINANCE_SECRET)');
    const qs = `${params}&recvWindow=10000&timestamp=${Date.now()}`;
    const signature = createHmac('sha256', secret).update(qs).digest('hex');
    const res = await fetch(`https://api.binance.com${path}?${qs}&signature=${signature}`, {
      headers: { 'X-MBX-APIKEY': key },
      signal: AbortSignal.timeout(15_000),
    }).catch(() => null);
    if (!res) throw new BadGatewayException('تعذّر الاتصال بـ Binance، حاول بعد قليل');
    if (res.status === 451) throw new BadGatewayException('Binance يرفض الطلب من منطقة الخادم (451) — يجب تشغيل الـ API في أوروبا');
    const body = await res.json().catch(() => null);
    if (!res.ok || !body) throw new BadGatewayException(`خطأ من Binance${body?.msg ? `: ${body.msg}` : ''}`);
    return body;
  }
}
