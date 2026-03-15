import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from '../entities/subscription.entity';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    @InjectRepository(Subscription)
    private subscriptionRepository: Repository<Subscription>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user; // نفترض أنك تستخدم AuthGuard قبل هذا الحارس

    if (!user) {
      throw new UnauthorizedException('يجب تسجيل الدخول أولاً');
    }

    // البحث عن اشتراك نشط لهذا المستخدم
    const activeSubscription = await this.subscriptionRepository.findOne({
      where: {
        userId: user.id,
        status: 'active',
      },
      order: { endDate: 'DESC' }, // جلب أحدث اشتراك في حال وجود تداخل
    });

    if (!activeSubscription) {
      throw new ForbiddenException('لا يوجد اشتراك نشط. يرجى الاشتراك للوصول إلى هذه الميزة.');
    }

    // التحقق من تاريخ انتهاء الصلاحية
    const now = new Date();
    if (activeSubscription.endDate < now) {
      // يمكنك هنا تحديث حالة الاشتراك في قاعدة البيانات إلى 'expired' تلقائياً
      throw new ForbiddenException('لقد انتهت صلاحية اشتراكك.');
    }

    return true; // السماح بالمرور
  }
}