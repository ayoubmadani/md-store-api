import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { UserService } from "../user/user.service";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { AuthProvider } from "../user/entities/user.entity";
import { CreateUserDto } from "../user/dto/create-user.dto";
import { MailService } from "../mail/mail.service";
import { UpdateUserDto } from "../user/dto/update-user.dto";
import { VerifyEmailDto } from "./dto/verifyEmail.dto";
import { ResetPasswordDto } from "./dto/resetPassword";
import { CredentialLoginDto } from "./dto/credentialLogin.dto";
import { GoogleLoginDto } from "./dto/googleLogin.dto";
import { access } from "fs";

@Injectable()
export class AuthService {
    constructor(
        private readonly userService: UserService,
        private readonly jwtService: JwtService,
        private readonly mailService: MailService,
    ) { }

    async credentialLogin(dto: CredentialLoginDto) {
        const user = await this.userService.findUserByEmail(dto.email);

        if (!user) {
            throw new NotFoundException('User not found');
        }

        // التحقق من تفعيل الحساب
        if (user.isVerified === false) {
            await this.resendOtp(dto.email);
            return {
                success: false,
                message: 'ACCOUNT_NOT_VERIFIED', // إضافة رسالة ليعرف الـ Frontend ماذا يفعل
                access_token: ""
            };
        }

        // منع الدخول التقليدي لحسابات جوجل (أمنياً أفضل)
        if (user.provider === AuthProvider.GOOGLE || user.provider === AuthProvider.CREDENTIALS_GOOGLE) {
            throw new BadRequestException('Please login with Google');
        }

        if (user.password) {
            const isMatch = await bcrypt.compare(dto.password, user.password);
            if (isMatch) {
                const payload = { sub: user.id, role: user.role };
                const token = await this.generateToken(payload);
                return {
                    access_token: token,
                    success: true
                };
            } else {
                throw new BadRequestException('Password does not match');
            }
        }
    }

    async GoogleLogin(dto: GoogleLoginDto) {
        const user = await this.userService.findUserByEmail(dto.email);

        if (!user) {
            throw new NotFoundException('User not found');
        }

        if (user.provider === AuthProvider.CREDENTIALS_GOOGLE || user.provider === AuthProvider.GOOGLE) {
            const payload = { sub: user.id, role: user.role };

            // ✅ الحل هنا: أضف await قبل استدعاء الدالة
            const token = await this.generateToken(payload);

            return {
                access_token: token, // الآن أصبح نصاً (JWT) وليس [object Promise]
                success: true
            };
        }
    }

    async register(dto: CreateUserDto) {
        return this.userService.create(dto)
    }

    async resendOtp(email: string) {
        // 1. البحث عن المستخدم
        const user = await this.userService.findUserByEmail(email);

        if (!user) {
            throw new NotFoundException('User not found');
        }

        // 2. توليد الرمز الجديد والوقت
        const otp = Math.floor(10000 + Math.random() * 90000);
        const otpExpires = new Date();
        otpExpires.setMinutes(otpExpires.getMinutes() + 10);

        // 3. تحديث المستخدم (نمرر البيانات والـ ID)
        await this.userService.updateUser(
            { otp, otpExpires } as UpdateUserDto,
            user.id
        );

        // 4. إرسال البريد الجديد
        await this.mailService.sendOTP(email, otp);

        return { success: true, message: 'A new OTP has been sent to your email' };
    }

    async verifyEmail(dto: VerifyEmailDto) {
        // 1. البحث عن المستخدم
        const user = await this.userService.findUserByEmail(dto.email);

        if (!user) {
            throw new NotFoundException('User Not Found');
        }



        // 2. التحقق من تطابق الرمز
        if (user.otp !== dto.otp) {
            throw new BadRequestException('Invalid OTP code');
        }

        // 3. التحقق من صلاحية الوقت
        const now = new Date();
        if (user.otpExpires && user.otpExpires < now) {
            throw new BadRequestException('OTP has expired');
        }

        // 4. تحديث حالة المستخدم (تفعيل الحساب وتصفير الـ OTP)
        await this.userService.updateUser(
            {
                isVerified: true,
                otp: null,
                otpExpires: null
            } as any,
            user.id
        );

        return { success: true, message: 'Email verified successfully' };
    }

    async verifyOTP(dto: VerifyEmailDto) {
        // 1. البحث عن المستخدم
        const user = await this.userService.findUserByEmail(dto.email);

        if (!user) {
            throw new NotFoundException('User Not Found');
        }



        // 2. التحقق من تطابق الرمز
        if (user.otp !== dto.otp) {
            throw new BadRequestException('Invalid OTP code');
        }

        // 3. التحقق من صلاحية الوقت
        const now = new Date();
        if (user.otpExpires && user.otpExpires < now) {
            throw new BadRequestException('OTP has expired');
        }

        return { success: true, message: 'Otp Send successfully' };
    }

    async forgotPassword(email: string) {
        // 1. التأكد من وجود المستخدم
        const user = await this.userService.findUserByEmail(email);
        if (!user) {
            throw new NotFoundException('هذا البريد الإلكتروني غير مسجل لدينا');
        }

        // 2. توليد رمز OTP جديد ووقت انتهاء
        const otp = Math.floor(10000 + Math.random() * 90000);
        const otpExpires = new Date();
        otpExpires.setMinutes(otpExpires.getMinutes() + 15); // صلاحية أطول قليلاً 15 دقيقة

        // 3. حفظ الرمز في قاعدة البيانات
        await this.userService.updateUser(
            { otp, otpExpires } as any,
            user.id
        );

        // 4. إرسال البريد الإلكتروني بتصميم مختلف (اختياري)
        await this.mailService.sendOTP(email, otp);

        return { message: 'تم إرسال رمز إعادة تعيين كلمة المرور إلى بريدك الإلكتروني' };
    }



    async resetPassword(dto: ResetPasswordDto) {
        // 1. البحث عن المستخدم
        const user = await this.userService.findUserByEmail(dto.email);

        if (!user) {
            throw new NotFoundException('User Not Found');
        }

        // 2. التحقق من الرمز (استخدام == لتجنب مشاكل النوع string/number)
        if (user.otp != dto.otp) {
            throw new BadRequestException('Invalid OTP code');
        }

        // 3. التحقق من الوقت (اختياري ولكنه أفضل أمنياً)
        const now = new Date();
        if (user.otpExpires && user.otpExpires < now) {
            throw new BadRequestException('OTP has expired');
        }

        // 4. تحديث كلمة المرور ومسح الـ OTP
        await this.userService.updateUser(
            {
                password: dto.password,
                otp: null,         // مسح الرمز لضمان الأمان
                otpExpires: null,   // مسح وقت الانتهاء
            } as any,
            user.id
        );

        return { message: 'Password has been reset successfully' };
    }

    // في auth.service.ts
    async validateGoogleUser(googleUser: any) {
        let user;
        try {
            // سيحاول البحث، وإذا لم يجده سيرمي Exception
            user = await this.userService.findUserByEmail(googleUser.email);
        } catch (error) {
            // إذا رمى Exception "user not found"، نقوم بإنشاء مستخدم جديد
            if (error instanceof BadRequestException && error.message === 'user not found') {
                user = await this.userService.create({
                    email: googleUser.email,
                    username: googleUser.username,
                    image: googleUser.image,
                    isVerified: true,
                    provider: AuthProvider.GOOGLE,
                } as any);
            } else {
                throw error; // إذا كان خطأ آخر، نمرره
            }
        }
        return user;
    }

    async verifyToken(id: string) {
        const user = await this.userService.findUserById(id);

        return {
            isValid: true,
            user: { name: user.username, email: user.email }
        };
    }



    async generateToken(payload: any) {
        return await this.jwtService.signAsync(payload);
    }
}