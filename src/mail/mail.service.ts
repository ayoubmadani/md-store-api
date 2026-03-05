import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
  constructor(
    private readonly mailerService: MailerService,
) {}

  async sendOTP(email: string, otp: number) {
    const htmlContent = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 15px; text-align: center;">
        <h2 style="color: #333;">التحقق من الحساب</h2>
        <p style="color: #666; font-size: 16px;">استخدم الرمز التالي لإتمام عملية تسجيل الدخول. هذا الرمز صالح لمدة 10 دقائق فقط.</p>
        <div style="background-color: #f4f7ff; border-radius: 10px; padding: 20px; margin: 25px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 10px; color: #4361ee;">${otp}</span>
        </div>
        <p style="color: #999; font-size: 12px;">إذا لم تطلب هذا الرمز، يمكنك تجاهل هذا البريد بأمان.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="color: #4361ee; font-weight: bold;">شكراً لانضمامك إلينا!</p>
      </div>
    `;

    await this.mailerService.sendMail({
      to: email,
      subject: 'رمز التحقق (OTP) الخاص بك',
      html: htmlContent,
    });
  }
}