import { BadRequestException, forwardRef, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Plan } from './entities/plan.entity';
import { Subscription } from './entities/subscription.entity';
import { DataSource, Repository } from 'typeorm';
import { PaymentService } from '../payment/payment.service';
import { TransactionType } from '../payment/entities/transaction.entity';

@Injectable()
export class SubscriptionService {
    // ─── In-memory cache لتجنب query متكررة في نفس الـ request ───────────────
    // findSub تُستدعى من: StoreService × 2، ProductService، LandingPageService، UserService
    // بدون cache = 5+ queries لنفس البيانات في كل request
    private readonly subCache = new Map<string, { data: Subscription | null; ts: number }>();
    private readonly SUB_CACHE_TTL = 60_000; // دقيقة واحدة

    constructor(
        @InjectRepository(Subscription) private readonly subRepo: Repository<Subscription>,
        @InjectRepository(Plan) private readonly planRepo: Repository<Plan>,
        private dataSource: DataSource,
        @Inject(forwardRef(() => PaymentService))
        private paymentService: PaymentService,
    ) {}

    // ─── invalidate عند أي تغيير في الاشتراك ────────────────────────────────
    private invalidateSubCache(userId: string) {
        this.subCache.delete(userId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    async subscribeToPlan(userId: string, planId: string, interval: 'month' | 'year') {
        const plan = await this.planRepo.findOne({ where: { id: planId, isActive: true } });
        if (!plan) throw new NotFoundException('الخطة غير موجودة أو غير متاحة حالياً');

        const price = interval === 'year' ? Number(plan.yearlyPrice) : Number(plan.monthlyPrice);

        const existing = await this.subRepo.findOne({
            where: { userId, status: 'active' },
            relations: ['plan'],
        });
        if (existing) {
            const existingPrice = existing.interval === 'year'
                ? Number(existing.plan.yearlyPrice)
                : Number(existing.plan.monthlyPrice);
            if (existingPrice > 0) throw new BadRequestException('أنت مشترك بالفعل في خطة نشطة');
        }

        await this.subRepo.update({ userId, status: 'active' }, { status: 'expired' });

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const startDate = new Date();
            const endDate = new Date();
            if (interval === 'month') endDate.setMonth(startDate.getMonth() + 1);
            else endDate.setFullYear(startDate.getFullYear() + 1);

            if (price > 0) {
                await this.paymentService.handleWalletBalance(
                    userId, price, 'SUB', TransactionType.PLAN_SUBSCRIPTION, queryRunner.manager,
                );
            }

            const newSub = this.subRepo.create({ userId, planId, interval, status: 'active', startDate, endDate });
            await queryRunner.manager.save(newSub);
            await queryRunner.commitTransaction();

            this.invalidateSubCache(userId); // ← invalidate بعد التغيير
            return { success: true, message: `تم الاشتراك في خطة ${plan.name} بنجاح`, expiresAt: endDate };
        } catch (error) {
            await queryRunner.rollbackTransaction();
            throw new BadRequestException(error.message || 'فشلت عملية الاشتراك');
        } finally {
            await queryRunner.release();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ✅ الدالة الأهم — مع cache لتجنب 5+ queries في كل request
    async findSub(userId: string): Promise<Subscription | null> {
        // فحص الـ cache أولاً
        const cached = this.subCache.get(userId);
        if (cached && Date.now() - cached.ts < this.SUB_CACHE_TTL) {
            return cached.data;
        }

        const subscription = await this.subRepo.findOne({
            where: { userId, status: 'active' },
            relations: ['plan', 'plan.features'],
            order: { startDate: 'DESC' },
        });

        if (!subscription) {
            const result = await this.activateFreePlan(userId);
            this.subCache.set(userId, { data: result, ts: Date.now() });
            return result;
        }

        if (new Date() > subscription.endDate) {
            subscription.status = 'expired';
            await this.subRepo.save(subscription);
            this.invalidateSubCache(userId);

            const paidPrice = subscription.interval === 'year'
                ? Number(subscription.plan.yearlyPrice)
                : Number(subscription.plan.monthlyPrice);

            let result: Subscription | null;
            if (subscription.autoRenew && paidPrice > 0) {
                result = await this.renewPlan(userId, subscription.planId, subscription.interval);
            } else {
                result = await this.activateFreePlan(userId);
            }

            this.subCache.set(userId, { data: result, ts: Date.now() });
            return result;
        }

        // cache النتيجة
        this.subCache.set(userId, { data: subscription, ts: Date.now() });
        return subscription;
    }

    // ─────────────────────────────────────────────────────────────────────────
    private async renewPlan(userId: string, planId: string, interval: 'month' | 'year'): Promise<Subscription | null> {
        const plan = await this.planRepo.findOne({ where: { id: planId, isActive: true } });
        if (!plan) return this.activateFreePlan(userId);

        const price = interval === 'year' ? Number(plan.yearlyPrice) : Number(plan.monthlyPrice);

        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const startDate = new Date();
            const endDate = new Date();
            if (interval === 'month') endDate.setMonth(startDate.getMonth() + 1);
            else endDate.setFullYear(startDate.getFullYear() + 1);

            await this.paymentService.handleWalletBalance(
                userId, price, 'SUB', TransactionType.PLAN_SUBSCRIPTION, queryRunner.manager,
            );

            const newSub = this.subRepo.create({ userId, planId, interval, status: 'active', startDate, endDate, autoRenew: true });
            await queryRunner.manager.save(newSub);
            await queryRunner.commitTransaction();

            return this.subRepo.findOne({ where: { id: newSub.id }, relations: ['plan', 'plan.features'] });
        } catch {
            await queryRunner.rollbackTransaction();
            return this.activateFreePlan(userId);
        } finally {
            await queryRunner.release();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    private async activateFreePlan(userId: string): Promise<Subscription | null> {
        // ✅ select فقط الحقول الضرورية بدل SELECT *
        const freePlan = await this.planRepo
            .createQueryBuilder('plan')
            .leftJoinAndSelect('plan.features', 'features')
            .where('plan.isActive = true AND plan.monthlyPrice = 0 AND plan.yearlyPrice = 0')
            .select(['plan.id', 'plan.name', 'features'])
            .getOne();

        if (!freePlan) return null;

        const startDate = new Date();
        const endDate = new Date();
        endDate.setFullYear(startDate.getFullYear() + 100);

        const newSub = await this.subRepo.save(
            this.subRepo.create({ userId, planId: freePlan.id, interval: 'month', status: 'active', autoRenew: false, startDate, endDate })
        );

        return this.subRepo.findOne({ where: { id: newSub.id }, relations: ['plan', 'plan.features'] });
    }

    // ─────────────────────────────────────────────────────────────────────────
    async setAutoRenew(userId: string, autoRenew: boolean) {
        const subscription = await this.subRepo.findOne({ where: { userId, status: 'active' } });
        if (!subscription) throw new NotFoundException('لا يوجد اشتراك نشط');

        subscription.autoRenew = autoRenew;
        await this.subRepo.save(subscription);

        this.invalidateSubCache(userId);
        return { success: true, autoRenew };
    }
}