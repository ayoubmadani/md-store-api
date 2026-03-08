import { Injectable, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Wallet } from "./entities/wallets.entity";
import { Repository, DataSource } from "typeorm";
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

    // 2. الـ Webhook: هذه الوظيفة تستدعى تلقائياً من Chargily بعد نجاح الدفع
    async handleWebhook(payload: any) {
        // التحقق من نوع الحدث (إذا نجح الدفع)
        if (payload.type === 'checkout.paid') {
            const userId = payload.data.metadata.userId;
            const amount = payload.data.amount;

            console.log(userId);
            

            // هنا نستخدم كود الـ topUpWallet الذي كتبناه سابقاً لإضافة الرصيد فعلياً
            return await this.completeWalletTopUp(userId, amount);
        }
    }

    private async completeWalletTopUp(userId: string, amount: number) {
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();
        try {
            let wallet = await queryRunner.manager.findOne(Wallet, { where: { userId: String(userId) } });
            if (!wallet) {
                wallet = queryRunner.manager.create(Wallet, { userId: String(userId), balance: 0 });
            }
            wallet.balance = Number(wallet.balance) + amount;
            await queryRunner.manager.save(wallet);
            console.log({userId});
            
            const transaction = queryRunner.manager.create(Transaction, {
                action: TransactionAction.TOP_UP,
                type: TransactionType.WALLET,
                amount: amount,
                userId: userId,
            });
            await queryRunner.manager.save(transaction);
            await queryRunner.commitTransaction();
        } catch (err) {
            await queryRunner.rollbackTransaction();
            throw err;
        } finally {
            await queryRunner.release();
        }
    }

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