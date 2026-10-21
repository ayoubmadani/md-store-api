import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, MoreThan, Repository } from 'typeorm';
import { CryptoTopup } from './crypto-topup.entity';
import { BinanceDepositClient } from './binance-deposit.client';
import { PaymentService } from '../payment.service';
import { TransactionType } from '../entities/transaction.entity';
import { PlatformSettingsService } from '../../platform-settings/platform-settings.service';

// شحن المحفظة بـ USDT: التاجر يحوّل من حسابه في Binance إلى عنوان المنصة، ثم يُدخل رقم التحويل فقط.
// نقبل التحويل الداخلي (Binance → Binance) فقط: لا يظهر على البلوكتشين العام، فرقمه لا يعرفه إلا المرسل
// — لذلك لا حاجة لمبلغ فريد. حماية من تخمين الأرقام: 5 محاولات فاشلة في الساعة لكل تاجر.
const NETWORKS = ['TRX', 'BSC'];
const OK_STATUSES = [1, 6]; // 1 = مكتمل، 6 = وصل (قيد الإفراج للسحب)
const LOOKBACK_MS = 7 * 24 * 3600_000; // تحويلات آخر 7 أيام
const MAX_FAILED_PER_HOUR = 5;

const normalizeTxId = (v: string) => String(v || '').trim().replace(/^(off-chain|internal)\s+transfer\s+/i, '');

@Injectable()
export class BinanceTopupService {
  constructor(
    @InjectRepository(CryptoTopup) private readonly repo: Repository<CryptoTopup>,
    private readonly binance: BinanceDepositClient,
    private readonly payment: PaymentService,
    private readonly settings: PlatformSettingsService,
    private readonly dataSource: DataSource,
  ) { }

  private async config() {
    const s = await this.settings.getAll();
    const addresses = Object.fromEntries(
      [['TRX', s.binanceTrc20Address], ['BSC', s.binanceBep20Address]].filter(([, v]) => v),
    ) as Record<'TRX' | 'BSC', string>;
    const enabled = !!(s.binanceEnabled && s.usdtRateDzd && Object.keys(addresses).length);
    return { enabled, rate: Number(s.usdtRateDzd), addresses };
  }

  // للواجهة: هل الطريقة متاحة، السعر، وعناوين الإيداع
  async publicConfig() {
    const c = await this.config();
    return c.enabled ? { enabled: true, rate: c.rate, addresses: c.addresses } : { enabled: false, rate: null, addresses: {} };
  }

  private failed(userId: string, txId: string, network: string | null = null) {
    return this.repo.save(this.repo.create({
      userId, amountDzd: '0', amountUsdt: '0', rate: '0', status: 'failed' as any, txId: null, network, expiresAt: new Date(),
    })).catch(() => undefined);
  }

  async claim(userId: string, rawCode: string) {
    const uid = String(userId);
    const code = normalizeTxId(rawCode);
    if (!code || code.length > 128) throw new BadRequestException('أدخل رقم التحويل');
    const { enabled, rate } = await this.config();
    if (!enabled) throw new ForbiddenException('الدفع بـ Binance غير متاح حالياً');

    const recentFails = await this.repo.count({ where: { userId: uid, status: 'failed' as any, createdAt: MoreThan(new Date(Date.now() - 3600_000)) } });
    if (recentFails >= MAX_FAILED_PER_HOUR) {
      throw new HttpException('محاولات كثيرة غير صحيحة — حاول بعد ساعة', HttpStatus.TOO_MANY_REQUESTS);
    }

    const deposits = await this.binance.listUsdtDeposits(Date.now() - LOOKBACK_MS);
    const dep = deposits.find((d) => normalizeTxId(d.txId) === code);
    const reject = async (message: string, Err: typeof BadRequestException | typeof NotFoundException = BadRequestException) => {
      await this.failed(uid, code, dep?.network ?? null);
      throw new Err(message);
    };
    if (!dep) return reject('رقم التحويل غير موجود في حساب المنصة — تأكد من الرقم ومن التحويل إلى العنوان الصحيح', NotFoundException);
    if (Number(dep.transferType) !== 1) return reject('نقبل حالياً التحويل من حساب Binance فقط (Internal transfer)');
    if (dep.coin !== 'USDT') return reject('العملة ليست USDT');
    if (!NETWORKS.includes(dep.network)) return reject('الشبكة غير مقبولة — TRC20 أو BEP20');
    if (!OK_STATUSES.includes(Number(dep.status))) return reject('التحويل لم يكتمل بعد، أعد المحاولة بعد دقائق');

    const amountUsdt = Number(dep.amount);
    const amountDzd = Math.round(amountUsdt * rate * 100) / 100;
    if (!(amountDzd > 0)) return reject('مبلغ التحويل غير صالح');

    await this.dataSource.transaction(async (manager) => {
      const res: any = await this.payment.handleWalletBalance(uid, amountDzd, 'ADD', TransactionType.TOP_UP, manager, `binance:${dep.txId}`);
      if (res?.message === 'Transaction already processed') throw new BadRequestException('رقم التحويل هذا استُعمل من قبل');
      await manager.save(CryptoTopup, {
        userId: uid,
        amountDzd: amountDzd.toFixed(2),
        amountUsdt: amountUsdt.toFixed(4),
        rate: rate.toFixed(2),
        status: 'paid',
        txId: dep.txId,
        network: dep.network,
        expiresAt: new Date(),
        paidAt: new Date(),
      });
    });
    return { status: 'paid' as const, amountDzd, amountUsdt };
  }
}
