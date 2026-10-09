import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * دخول Google من تطبيق التأكيد عبر نفس استراتيجية "google" ونفس رابط الرجوع
 * المسجّل في Google Console — state=confirm يخبر الـ callback أين يعيد المستخدم.
 */
@Injectable()
export class GoogleConfirmGuard extends AuthGuard('google') {
  getAuthenticateOptions() {
    return { state: 'confirm' };
  }
}
