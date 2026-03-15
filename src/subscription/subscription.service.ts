import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
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
        @InjectRepository(Plan) private readonly planRepo: Repository<Plan>,

        private dataSource: DataSource,
        private paymentService: PaymentService,
    ) { }

    async subscribeToPlan(userId: string, planId: string) {
        // 1. الحصول على بيانات الخطة
        const plan = await this.planRepo.findOne({ where: { id: planId, isActive: true } });
        if (!plan) {
            throw new NotFoundException('الخطة غير موجودة أو غير متاحة حالياً');
        }

        // 2. التحقق من وجود اشتراك نشط حالي لإنهاء صلاحيته (إذا وُجد)
        await this.subRepo.update(
            { userId, status: 'active' },
            { status: 'expired' } // أو 'canceled' حسب رغبتك عند الترقية
        );

        // 3. بدء عملية Transaction لضمان سحب الرصيد وتفعيل الاشتراك معاً
        const queryRunner = this.dataSource.createQueryRunner();
        await queryRunner.connect();
        await queryRunner.startTransaction();

        try {
            const price = Number(plan.price);
            const startDate = new Date();
            const endDate = new Date();

            // حساب تاريخ الانتهاء بناءً على دورة الخطة (شهر أم سنة)
            if (plan.interval === 'month') {
                endDate.setMonth(startDate.getMonth() + 1);
            } else {
                endDate.setFullYear(startDate.getFullYear() + 1);
            }

            // 4. خصم المبلغ من المحفظة (باستخدام الخدمة التي أعددتها سابقاً)
            if (price > 0) {
                await this.paymentService.handleWalletBalance(
                    userId,
                    price,
                    "SUB", // نوع العملية: اشتراك
                    TransactionType.PLAN_SUBSCRIPTION, // افترضت وجود هذا الـ Enum
                    queryRunner.manager,
                );
            }

            // 5. إنشاء سجل الاشتراك الجديد
            const newSubscription = this.subRepo.create({
                userId,
                planId,
                status: 'active',
                startDate,
                endDate,
            });

            await queryRunner.manager.save(newSubscription);

            // اعتماد العملية
            await queryRunner.commitTransaction();

            return {
                success: true,
                message: `تم الاشتراك في خطة ${plan.name} بنجاح`,
                expiresAt: endDate
            };

        } catch (error) {
            // التراجع في حال نقص الرصيد أو حدوث خطأ
            await queryRunner.rollbackTransaction();
            throw new BadRequestException(error.message || 'فشلت عملية الاشتراك');
        } finally {
            await queryRunner.release();
        }
    }

    async findSub(userId: string) {
        // البحث عن آخر اشتراك نشط للمستخدم
        const subscription = await this.subRepo.findOne({
            where: {
                userId,
                status: 'active'
            },
            relations: ['plan'], // جلب بيانات الخطة (الاسم، السعر، المميزات)
            order: {
                startDate: 'DESC' // لضمان جلب أحدث اشتراك في حال وجود سجلات قديمة
            }
        });

        if (!subscription) {
            // يمكنك إرجاع نال (null) أو رمي استثناء حسب منطق تطبيقك
            // هنا سنعيد null لنتمكن من التعامل مع "الخطة المجانية" لاحقاً
            return null;
        }

        // التحقق من صلاحية التاريخ (إجراء أمان إضافي)
        const isExpired = new Date() > subscription.endDate;
        if (isExpired) {
            // إذا انتهى التاريخ ولم يقم الكرون جوب بتحديثه بعد، نحدثه هنا
            subscription.status = 'expired';
            await this.subRepo.save(subscription);
            return null;
        }

        return subscription;
    }
}
