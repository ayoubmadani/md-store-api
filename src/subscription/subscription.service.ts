import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Plan } from './entities/plan.entity';
import { Subscription } from './entities/subscription.entity';
import { DataSource, Repository } from 'typeorm';
import { PaymentService } from '../payment/payment.service';
import { TransactionType } from '../payment/entities/transaction.entity';

@Injectable()
export class SubscriptionService {
    constructor(
        @InjectRepository(Subscription) private readonly subRepo: Repository<Subscription>,
        @InjectRepository(Plan)         private readonly planRepo: Repository<Plan>,
        private dataSource:   DataSource,
        private paymentService: PaymentService,
    ) {}

    // ─────────────────────────────────────────────────────────────────────────
    async subscribeToPlan(userId: string, planId: string) {
        const plan = await this.planRepo.findOne({ where: { id: planId, isActive: true } });
        if (!plan) throw new NotFoundException('الخطة غير موجودة أو غير متاحة حالياً');

        // منع الاشتراك إذا كان المستخدم مشتركاً بالفعل في خطة مدفوعة نشطة
        const existing = await this.subRepo.findOne({
            where: { userId, status: 'active' },
            relations: ['plan'],
        });
        if (existing && Number(existing.plan.price) > 0) {
            throw new BadRequestException('أنت مشترك بالفعل في خطة نشطة');
        }

        // إنهاء أي اشتراك نشط حالي
        await this.subRepo.update({ userId, status: 'active' }, { status: 'expired' });

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const price     = Number(plan.price);
            const startDate = new Date();
            const endDate   = new Date();

            if (plan.interval === 'month') {
                endDate.setMonth(startDate.getMonth() + 1);
            } else {
                endDate.setFullYear(startDate.getFullYear() + 1);
            }

            if (price > 0) {
                await this.paymentService.handleWalletBalance(
                    userId,
                    price,
                    'SUB',
                    TransactionType.PLAN_SUBSCRIPTION,
                    queryRunner.manager,
                );
            }

            const newSub = this.subRepo.create({
                userId, planId, status: 'active', startDate, endDate,
            });

            await queryRunner.manager.save(newSub);
            await queryRunner.commitTransaction();

            return { success: true, message: `تم الاشتراك في خطة ${plan.name} بنجاح`, expiresAt: endDate };

        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw new BadRequestException(error.message || 'فشلت عملية الاشتراك');
        } finally {
            await queryRunner.release();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    async findSub(userId: string) {
        const subscription = await this.subRepo.findOne({
            where: { userId, status: 'active' },
            relations: ['plan'],
            order: { startDate: 'DESC' },
        });

        // لا يوجد اشتراك أصلاً → فعّل المجاني
        if (!subscription) {
            return this.activateFreePlan(userId);
        }

        // الاشتراك منتهي
        if (new Date() > subscription.endDate) {
            subscription.status = 'expired';
            await this.subRepo.save(subscription);

            // autoRenew → جدد نفس الخطة، وإلا → فعّل المجاني
            if (subscription.autoRenew && Number(subscription.plan.price) > 0) {
                return this.renewPlan(userId, subscription.planId);
            }

            return this.activateFreePlan(userId);
        }

        return subscription;
    }

    // ─────────────────────────────────────────────────────────────────────────
    /** تجديد الخطة تلقائياً — يخصم من المحفظة وينشئ اشتراكاً جديداً */
    private async renewPlan(userId: string, planId: string): Promise<Subscription | null> {
        const plan = await this.planRepo.findOne({ where: { id: planId, isActive: true } });

        // الخطة أُلغيت أو صارت غير نشطة → رجّع للمجاني
        if (!plan) return this.activateFreePlan(userId);

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const price     = Number(plan.price);
            const startDate = new Date();
            const endDate   = new Date();

            if (plan.interval === 'month') {
                endDate.setMonth(startDate.getMonth() + 1);
            } else {
                endDate.setFullYear(startDate.getFullYear() + 1);
            }

            // خصم الرصيد — إذا فشل (رصيد غير كافٍ) يتراجع ويرجع للمجاني
            await this.paymentService.handleWalletBalance(
                userId,
                price,
                'SUB',
                TransactionType.PLAN_SUBSCRIPTION,
                queryRunner.manager,
            );

            const newSub = this.subRepo.create({
                userId, planId, status: 'active', startDate, endDate, autoRenew: true,
            });

            await queryRunner.manager.save(newSub);
            await queryRunner.commitTransaction();

            return this.subRepo.findOne({ where: { id: newSub.id }, relations: ['plan'] });

        } catch {
            // رصيد غير كافٍ أو خطأ → تراجع وفعّل المجاني
            await queryRunner.rollbackTransaction();
            return this.activateFreePlan(userId);
        } finally {
            await queryRunner.release();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    private async activateFreePlan(userId: string): Promise<Subscription | null> {
        const freePlan = await this.planRepo.findOne({
            where: { isActive: true, price: 0 },
        });

        if (!freePlan) return null;

        const startDate = new Date();
        const endDate   = new Date();
        endDate.setFullYear(startDate.getFullYear() + 100); // المجانية لا تنتهي عملياً

        const newSub = this.subRepo.create({
            userId,
            planId:    freePlan.id,
            status:    'active',
            autoRenew: false,   // المجانية لا تحتاج تجديداً
            startDate,
            endDate,
        });

        return this.subRepo.save(newSub).then(saved =>
            this.subRepo.findOne({ where: { id: saved.id }, relations: ['plan'] })
        );
    }

     // ─────────────────────────────────────────────────────────────────────────
    async setAutoRenew(userId: string, autoRenew: boolean) {
        const subscription = await this.subRepo.findOne({
            where: { userId, status: 'active' },
        });

        if (!subscription) throw new NotFoundException('لا يوجد اشتراك نشط');

        subscription.autoRenew = autoRenew;
        await this.subRepo.save(subscription);

        return { success: true, autoRenew };
    }
}

   
