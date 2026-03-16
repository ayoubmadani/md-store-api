import { BadRequestException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
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

        @Inject(forwardRef(() => PaymentService)) 
        private paymentService: PaymentService,
    ) {}

    // ─────────────────────────────────────────────────────────────────────────
    // interval مطلوب الآن لاختيار السعر الصحيح (monthlyPrice أو yearlyPrice)
    async subscribeToPlan(userId: string, planId: string, interval: 'month' | 'year') {
        const plan = await this.planRepo.findOne({ where: { id: planId, isActive: true } });
        if (!plan) throw new NotFoundException('الخطة غير موجودة أو غير متاحة حالياً');

        // السعر يعتمد على الـ interval المختار
        const price = interval === 'year'
            ? Number(plan.yearlyPrice)
            : Number(plan.monthlyPrice);

        // منع الاشتراك إذا كان المستخدم مشتركاً في خطة مدفوعة نشطة
        const existing = await this.subRepo.findOne({
            where: { userId, status: 'active' },
            relations: ['plan'],
        });
        if (existing) {
            const existingPrice = existing.interval === 'year'
                ? Number(existing.plan.yearlyPrice)
                : Number(existing.plan.monthlyPrice);
            if (existingPrice > 0) {
                throw new BadRequestException('أنت مشترك بالفعل في خطة نشطة');
            }
        }

        // إنهاء أي اشتراك نشط حالي
        await this.subRepo.update({ userId, status: 'active' }, { status: 'expired' });

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const startDate = new Date();
            const endDate   = new Date();

            if (interval === 'month') {
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
                userId, planId, interval, status: 'active', startDate, endDate,
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
            relations: ['plan','plan.features'],
            order: { startDate: 'DESC' },
        });

        if (!subscription) {
            return this.activateFreePlan(userId);
        }

        if (new Date() > subscription.endDate) {
            subscription.status = 'expired';
            await this.subRepo.save(subscription);

            // السعر المدفوع يعتمد على الـ interval المحفوظ في الاشتراك
            const paidPrice = subscription.interval === 'year'
                ? Number(subscription.plan.yearlyPrice)
                : Number(subscription.plan.monthlyPrice);

            if (subscription.autoRenew && paidPrice > 0) {
                return this.renewPlan(userId, subscription.planId, subscription.interval);
            }

            return this.activateFreePlan(userId);
        }
        console.log(subscription.plan.features);
        

        return subscription;
    }

    // ─────────────────────────────────────────────────────────────────────────
    private async renewPlan(
        userId: string,
        planId: string,
        interval: 'month' | 'year',
    ): Promise<Subscription | null> {
        const plan = await this.planRepo.findOne({ where: { id: planId, isActive: true } });
        if (!plan) return this.activateFreePlan(userId);

        const price = interval === 'year'
            ? Number(plan.yearlyPrice)
            : Number(plan.monthlyPrice);

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const startDate = new Date();
            const endDate   = new Date();

            if (interval === 'month') {
                endDate.setMonth(startDate.getMonth() + 1);
            } else {
                endDate.setFullYear(startDate.getFullYear() + 1);
            }

            await this.paymentService.handleWalletBalance(
                userId,
                price,
                'SUB',
                TransactionType.PLAN_SUBSCRIPTION,
                queryRunner.manager,
            );

            const newSub = this.subRepo.create({
                userId, planId, interval, status: 'active', startDate, endDate, autoRenew: true,
            });

            await queryRunner.manager.save(newSub);
            await queryRunner.commitTransaction();

            return this.subRepo.findOne({ where: { id: newSub.id }, relations: ['plan'] });

        } catch {
            await queryRunner.rollbackTransaction();
            return this.activateFreePlan(userId);
        } finally {
            await queryRunner.release();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    private async activateFreePlan(userId: string): Promise<Subscription | null> {
        // البحث عن الخطة المجانية بـ monthlyPrice = 0
        const freePlan = await this.planRepo.findOne({
            where: { isActive: true, monthlyPrice: 0, yearlyPrice: 0 },
        });

        if (!freePlan) return null;

        const startDate = new Date();
        const endDate   = new Date();
        endDate.setFullYear(startDate.getFullYear() + 100);

        const newSub = this.subRepo.create({
            userId,
            planId:    freePlan.id,
            interval:  'month',  // المجانية تعتبر شهرية بالاسم فقط
            status:    'active',
            autoRenew: false,
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