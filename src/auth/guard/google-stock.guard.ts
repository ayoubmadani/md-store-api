import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * دخول Google من تطبيق المخزون عبر نفس استراتيجية "google" ونفس رابط الرجوع
 * المسجّل في Google Console — state=stock يخبر الـ callback أين يعيد المستخدم.
 */
@Injectable()
export class GoogleStockGuard extends AuthGuard('google') {
  getAuthenticateOptions() {
    return { state: 'stock' };
  }
}
