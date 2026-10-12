import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Wallet } from '../payment/entities/wallets.entity';
import { Transaction, TransactionAction, TransactionType } from '../payment/entities/transaction.entity';
import { ConfirmationAction, ConfirmationLog } from './entities/confirmation-log.entity';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * رسوم المنصة على شركة التأكيد: مبلغ ثابت يحدده مدير المنصة (confirmationFee، الافتراضي 12 د.ج)
 * يُخصم من محفظة صاحب الشركة عن كل طلب تؤكده. التاجر والشركة يتفاهمان على
 * أجر التأكيد خارج المنصة — لا شيء يُخصم من التاجر.
 */
@Injectable()
export class ConfirmationBillingService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly settings: PlatformSettingsService,
  ) {}

  fee(): Promise<number> {
    return this.settings.get('confirmationFee');
  }

  async balanceOf(userId: string): Promise<number> {
    const wallet = await this.dataSource.getRepository(Wallet).findOne({ where: { userId } });
    return round2(Number(wallet?.balance ?? 0));
  }

  /** قبل أخذ طلب من القائمة: لا فائدة من الاتصال بالزبون إن تعذّر التأكيد بعده */
  async assertCanPay(ownerId: string) {
    const fee = await this.fee();
    if (fee > 0 && (await this.balanceOf(ownerId)) < fee) {
      throw new BadRequestException({ message: this.lowBalanceMessage(fee), code: 'insufficient_balance' });
    }
  }

  /**
   * يُستدعى داخل معاملة التأكيد: يخصم الرسوم مرة واحدة لكل طلب
   * (confirmationPaidAt يُضبط عند أول تأكيد فقط). رصيد غير كافٍ ← التأكيد يُرفض كله.
   */
  async chargeOnConfirm(manager: EntityManager, orderId: string, companyId: string, ownerId: string) {
    const fee = await this.fee();
    if (fee <= 0) return;

    const claimed: unknown[] = await manager.query(
      `UPDATE "orders" SET "confirmationPaidAt" = now(), "confirmationCommission" = $2
        WHERE id = $1 AND "confirmationPaidAt" IS NULL
      RETURNING id`,
      [orderId, fee],
    );
    // pg يرجع [rows, count] لـ UPDATE ... RETURNING
    const rows = Array.isArray(claimed[0]) ? (claimed[0] as unknown[]) : claimed;
    if (!rows.length) return; // دُفعت سابقاً (أُكّد ثم أُعيد تأكيده)

    const wallet = await manager.findOne(Wallet, { where: { userId: ownerId }, lock: { mode: 'pessimistic_write' } });
    const balance = round2(Number(wallet?.balance ?? 0));
    if (!wallet || balance < fee) {
      throw new BadRequestException({ message: this.lowBalanceMessage(fee), code: 'insufficient_balance' });
    }

    wallet.balance = round2(balance - fee);
    await manager.save(wallet);
    await manager.save(manager.create(Transaction, {
      action: TransactionAction.PAYMENT,
      type: TransactionType.CONFIRMATION_FEE,
      amount: fee,
      userId: ownerId,
    }));
    await manager.save(manager.create(ConfirmationLog, {
      orderId, companyId, agentId: null, action: ConfirmationAction.PAID, note: `fee=${fee}`,
    }));
  }

  private lowBalanceMessage(fee: number) {
    return `رصيد محفظة الشركة غير كافٍ — كل طلب مؤكد يكلّف ${fee} د.ج. اطلب من مدير الشركة شحن المحفظة.`;
  }
}
