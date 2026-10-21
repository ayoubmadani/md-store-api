import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, MoreThan, Repository } from 'typeorm';
import { CryptoTopup } from './crypto-topup.entity';
import { BinanceDepositClient } from './binance-deposit.client';
import { PaymentService } from '../payment.service';
import { TransactionType } from '../entities/transaction.entity';
import { PlatformSettingsService } from '../../platform-settings/platform-settings.service';

const NETWORKS = ['TRX', 'BSC'] as const; // TRC20 و BEP20
const OK_STATUSES = [1, 6]; // 1 = مكتمل، 6 = وصل (قيد الإفراج للسحب) — المال في الحساب في الحالتين
const PAY_WINDOW_MS = 60 * 60_000; // مدة الدفع المعروضة للتاجر
const CONFIRM_GRACE_MS = 24 * 3600_000; // التأكيد مقبول حتى 24 ساعة (تأخر الشبكة/نسيان)
const MIN_DZD = 500;
const MAX_DZD = 500_000;

// مبلغ USDT فريد: المبلغ الأساسي (سنتان) + كسر من 4 أرقام لا يستعمله طلب معلّق آخر
export function uniqueUsdtAmount(base: number, taken: Set<string>, rand: () => number = Math.random): string {
  const start = Math.floor(rand() * 99) + 1; // 0.0001 .. 0.0099
  for (let i = 0; i < 99; i++) {
    const suffix = ((start - 1 + i) % 99) + 1;
    const value = (Math.round(base * 100) / 100 + suffix / 10_000).toFixed(4);
    if (!taken.has(value)) return value;
  }
  throw new BadRequestException('طلبات كثيرة بنفس المبلغ الآن، غيّر المبلغ قليلاً أو حاول بعد دقائق');
}

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
    if (!s.binanceEnabled || !s.usdtRateDzd || (!s.binanceTrc20Address && !s.binanceBep20Address)) {
      throw new ForbiddenException('الدفع بـ Binance غير متاح حالياً');
    }
    return { rate: Number(s.usdtRateDzd), addresses: { TRX: s.binanceTrc20Address, BSC: s.binanceBep20Address } };
  }

  // للواجهة: هل الطريقة متاحة وبأي سعر (بدون رمي خطأ)
  async publicConfig() {
    const s = await this.settings.getAll();
    const enabled = !!(s.binanceEnabled && s.usdtRateDzd && (s.binanceTrc20Address || s.binanceBep20Address));
    return { enabled, rate: enabled ? Number(s.usdtRateDzd) : null, minDzd: MIN_DZD, maxDzd: MAX_DZD };
  }

  async createRequest(userId: string, amountDzd: number) {
    const amount = Math.round(Number(amountDzd) * 100) / 100;
    if (!Number.isFinite(amount) || amount < MIN_DZD || amount > MAX_DZD) {
      throw new BadRequestException(`المبلغ بين ${MIN_DZD} و ${MAX_DZD} د.ج`);
    }
    const { rate, addresses } = await this.config();
    // المبالغ المحجوزة: كل طلب معلّق ما زال يُقبل تأكيده
    const pending = await this.repo.find({ where: { status: 'pending', createdAt: MoreThan(new Date(Date.now() - CONFIRM_GRACE_MS - PAY_WINDOW_MS)) } });
    const amountUsdt = uniqueUsdtAmount(amount / rate, new Set(pending.map((p) => Number(p.amountUsdt).toFixed(4))));
    const saved = await this.repo.save(this.repo.create({
      userId: String(userId),
      amountDzd: amount.toFixed(2),
      amountUsdt,
      rate: rate.toFixed(2),
      status: 'pending',
      expiresAt: new Date(Date.now() + PAY_WINDOW_MS),
    }));
    return {
      id: saved.id,
      amountDzd: amount,
      amountUsdt,
      rate,
      addresses: Object.fromEntries(Object.entries(addresses).filter(([, v]) => v)) as Record<'TRX' | 'BSC', string>,
      expiresAt: saved.expiresAt,
    };
  }

  async confirm(userId: string, requestId: string, rawTxId: string) {
    const txId = String(rawTxId || '').trim();
    if (!txId || txId.length > 128) throw new BadRequestException('أدخل رقم المعاملة (TxID)');
    const req = await this.repo.findOne({ where: { id: requestId } });
    if (!req || req.userId !== String(userId)) throw new NotFoundException('طلب الشحن غير موجود');
    if (req.status === 'paid') return { status: 'paid' as const, amountDzd: Number(req.amountDzd) };

    const created = new Date(req.createdAt).getTime();
    if (Date.now() > created + PAY_WINDOW_MS + CONFIRM_GRACE_MS) throw new BadRequestException('انتهت صلاحية طلب الشحن، أنشئ طلباً جديداً');

    const deposits = await this.binance.listUsdtDeposits(created - 5 * 60_000);
    const dep = deposits.find((d) => String(d.txId).trim() === txId);
    if (!dep) throw new NotFoundException('المعاملة غير موجودة بعد في حساب Binance — انتظر تأكيد الشبكة ثم أعد المحاولة');
    if (dep.coin !== 'USDT') throw new BadRequestException('العملة ليست USDT');
    if (!NETWORKS.includes(dep.network as (typeof NETWORKS)[number])) throw new BadRequestException('الشبكة غير مقبولة — استعمل TRC20 أو BEP20');
    if (!OK_STATUSES.includes(Number(dep.status))) throw new BadRequestException('المعاملة لم تكتمل بعد، أعد المحاولة بعد دقائق');
    // المبلغ الفريد يربط الإيداع بهذا الطلب: TxID منسوخ من معاملة غيرك لن يطابق
    if (Math.abs(Number(dep.amount) - Number(req.amountUsdt)) > 0.00005) {
      throw new BadRequestException(`المبلغ لا يطابق الطلب: المطلوب ${req.amountUsdt} USDT بالضبط`);
    }
    if (dep.insertTime < created - 5 * 60_000 || dep.insertTime > created + PAY_WINDOW_MS + CONFIRM_GRACE_MS) {
      throw new BadRequestException('وقت المعاملة خارج مدة هذا الطلب');
    }

    await this.dataSource.transaction(async (manager) => {
      const res: any = await this.payment.handleWalletBalance(String(userId), Number(req.amountDzd), 'ADD', TransactionType.TOP_UP, manager, `binance:${txId}`);
      if (res?.message === 'Transaction already processed') throw new BadRequestException('هذه المعاملة استُعملت من قبل');
      await manager.save(CryptoTopup, { ...req, status: 'paid', txId, network: dep.network, paidAt: new Date() });
    });
    return { status: 'paid' as const, amountDzd: Number(req.amountDzd) };
  }
}
