import { Injectable, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Wallet } from "./entities/wallets.entity";
import { Repository, DataSource, EntityManager } from "typeorm";
import { Transaction, TransactionAction, TransactionType } from "./entities/transaction.entity";
// استيراد حزمة Chargily
import { ChargilyClient } from '@chargily/chargily-pay';
import { ConfigService } from "@nestjs/config";


@Injectable()
export class PaymentService {
    private chargilyClient: ChargilyClient;

    constructor(
        @InjectRepository(Wallet) private readonly walletRepo: Repository<Wallet>,
        @InjectRepository(Transaction) private readonly transactionRepo: Repository<Transaction>,
        private dataSource: DataSource,
        private readonly config: ConfigService
    ) {
        // تهيئة العميل بمفتاح API الخاص بك
        this.chargilyClient = new ChargilyClient({
            api_key: config.get<string>('chargily_Secret_key')!,
            mode: 'test', // غيرها إلى 'live' عند النشر الفعلي
        });
    }

    // 1. بدء عملية شحن (إنشاء رابط دفع)
    async createTopUpSession(userId: number, amount: number) {
        try {
            // إنشاء Checkout باستخدام Chargily
            const checkout = await this.chargilyClient.createCheckout({
                amount: amount, // المبلغ بالدينار الجزائري
                currency: 'dzd',
                success_url: `${this.config.get('Api_URL')}/payment/payment-success`,
                failure_url: `${this.config.get('Api_URL')}/payment/payment-failure`,
                metadata: {
                    userId: String(userId),
                    action: 'top_up'
                },
            });

            return { checkoutUrl: checkout.checkout_url }; // توجيه المستخدم لهذا الرابط
        } catch (error) {
            throw new BadRequestException('خطأ في الاتصال ببوابة الدفع');
        }
    }

    async handleWebhook(payload: any) {
        // 1. التحقق من نوع الحدث
        if (payload.type === 'checkout.paid') {
            const userId = payload.data.metadata.userId;
            const amount = payload.data.amount;

            // 2. الحصول على المعرف الفريد لهذه العملية من Chargily
            // عادة ما يكون payload.data.id هو معرف الـ checkout
            const checkoutId = payload.data.id;

            // 3. نمرر الـ checkoutId للدالة للتأكد من عدم تكرارها
            return await this.handleWalletBalance(
                userId,
                amount,
                "ADD",
                TransactionType.TOP_UP,
                undefined,
                checkoutId // نمرر المعرف هنا
            );
        }
    }

    async handleWalletBalance(
        userId: string,
        amount: number,
        action: "SUB" | "ADD",
        type: TransactionType,
        existingManager?: EntityManager,
        providerTransactionId?: string // بارامتر جديد
    ) {
        const queryRunner = !existingManager ? this.dataSource.createQueryRunner() : null;
        const manager = existingManager || queryRunner!.manager;

        if (queryRunner) {
            await queryRunner.connect();
            await queryRunner.startTransaction();
        }

        try {
            // --- الخطوة الأهم لمنع التكرار ---
            if (providerTransactionId) {
                const existingTx = await manager.findOne(Transaction, {
                    where: { providerTransactionId: providerTransactionId }
                });

                // إذا كانت المعاملة موجودة مسبقاً، لا تفعل شيئاً وأرجع نجاح
                if (existingTx) {
                    if (queryRunner) await queryRunner.rollbackTransaction();
                    return { success: true, message: 'Transaction already processed' };
                }
            }
            // --------------------------------

            let wallet = await manager.findOne(Wallet, {
                where: { userId: String(userId) },
                lock: { mode: 'pessimistic_write' }
            });

            if (!wallet) {
                wallet = manager.create(Wallet, { userId: String(userId), balance: 0 });
            }

            if (action === "ADD") {
                wallet.balance = Number(wallet.balance) + amount;
            } else {
                if (Number(wallet.balance) < amount) {
                    throw new BadRequestException('عذراً، رصيدك غير كافٍ');
                }
                wallet.balance = Number(wallet.balance) - amount;
            }

            await manager.save(wallet);

            const transaction = manager.create(Transaction, {
                action: action === "ADD" ? TransactionAction.DESPOSIT : TransactionAction.PAYMENT,
                type,
                amount,
                userId: String(userId),
                providerTransactionId, // حفظ المعرف لمنع التكرار مستقبلاً
                description: `Operation: ${type} for User ${userId}`
            });

            await manager.save(transaction);

            if (queryRunner) await queryRunner.commitTransaction();

            return { success: true, newBalance: wallet.balance, transactionId: transaction.id };

        } catch (err) {
            if (queryRunner) await queryRunner.rollbackTransaction();
            throw err;
        } finally {
            if (queryRunner) await queryRunner.release();
        }
    }

    // 3 bay

    async getBalanceUser(userId: string) {
        const wallet = await this.walletRepo.findOne({
            where: { userId },
            // نستخدم 'user' وليس 'users' لأن هذا هو الاسم في Wallet Entity
            // ونستخدم 'user.transactions' للوصول للعمليات من خلال المستخدم
            relations: ['user', 'user.transactions'],
        });

        if (!wallet) {
            return { balance: 0, user: { transactions: [] } };
        }

        return wallet;
    }
}