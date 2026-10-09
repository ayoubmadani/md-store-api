import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { StatusEnum } from '../order/entities/order.entity';
import { Wallet } from '../payment/entities/wallets.entity';
import { Transaction, TransactionAction, TransactionType } from '../payment/entities/transaction.entity';
import { ConfirmationAction, ConfirmationLog } from './entities/confirmation-log.entity';

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * دفع عمولة شركة التأكيد عند تسليم الطلب:
 * - يُخصم مبلغ العمولة من محفظة التاجر (قد تصبح سالبة — دين يُسدَّد بالشحن القادم)،
 * - وتُضاف العمولة ناقص نسبة المنصة إلى محفظة صاحب الشركة.
 * آمنة للاستدعاء أكثر من مرة: confirmationPaidAt يُضبط مرة واحدة فقط.
 */
@Injectable()
export class ConfirmationBillingService {
  private readonly logger = new Logger(ConfirmationBillingService.name);

  constructor(private readonly dataSource: DataSource) {}

  /** لا يرمي أبداً — فشل الدفع لا يجب أن يُفشل تغيير حالة الطلب */
  async settleIfDelivered(orderId: string): Promise<void> {
    try {
      await this.dataSource.transaction((manager) => this.settle(manager, orderId));
    } catch (err) {
      this.logger.error(`Commission settlement failed for order ${orderId}`, err as Error);
    }
  }

  private async settle(manager: EntityManager, orderId: string) {
    // الحجز والتحقق في جملة واحدة: فقط طلب مسلَّم، مرسل لشركة، ولم يُدفع بعد
    const rows: Array<{
      confirmationCommission: string; confirmationPlatformRate: string | null;
      confirmationCompanyId: string; merchantId: string; ownerId: string;
    }> = await manager.query(
      `UPDATE "orders" o
          SET "confirmationPaidAt" = now()
         FROM "stores" s, "confirmation_companies" c
        WHERE o.id = $1
          AND o.status = $2
          AND o."confirmationCompanyId" IS NOT NULL
          AND o."confirmationPaidAt" IS NULL
          AND COALESCE(o."confirmationCommission", 0) > 0
          AND s.id = o."storeId"
          AND c.id = o."confirmationCompanyId"
      RETURNING o."confirmationCommission", o."confirmationPlatformRate", o."confirmationCompanyId",
                s."userId" AS "merchantId", c."ownerId"`,
      [orderId, StatusEnum.DELIVERED],
    );
    // pg يرجع [rows, count] لـ UPDATE ... RETURNING
    const row = (Array.isArray(rows[0]) ? rows[0][0] : rows[0]) as (typeof rows)[number] | undefined;
    if (!row) return;

    const commission = round2(Number(row.confirmationCommission));
    const rate = Number(row.confirmationPlatformRate ?? 0);
    const earning = round2(commission * (1 - rate));

    await this.moveMoney(manager, row.merchantId, -commission, TransactionType.CONFIRMATION_FEE);
    if (earning > 0) await this.moveMoney(manager, row.ownerId, earning, TransactionType.CONFIRMATION_EARNING);

    await manager.save(manager.create(ConfirmationLog, {
      orderId,
      companyId: row.confirmationCompanyId,
      agentId: null,
      action: ConfirmationAction.PAID,
      note: `commission=${commission} earning=${earning} platformRate=${rate}`,
    }));
  }

  private async moveMoney(manager: EntityManager, userId: string, delta: number, type: TransactionType) {
    let wallet = await manager.findOne(Wallet, { where: { userId }, lock: { mode: 'pessimistic_write' } });
    if (!wallet) wallet = manager.create(Wallet, { userId, balance: 0 });
    wallet.balance = round2(Number(wallet.balance) + delta);
    await manager.save(wallet);

    await manager.save(manager.create(Transaction, {
      action: delta >= 0 ? TransactionAction.DESPOSIT : TransactionAction.PAYMENT,
      type,
      amount: Math.abs(delta),
      userId,
    }));
  }
}
