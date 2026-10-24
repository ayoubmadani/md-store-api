import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { CreateUserDto } from "../user/dto/create-user.dto";
import { VerifyEmailDto } from "./dto/verifyEmail.dto";
import { ResetPasswordDto } from "./dto/resetPassword";
import { AuthGuard } from "@nestjs/passport";
import type { Response } from 'express';
import { ConfigService } from "@nestjs/config";
import { CredentialLoginDto } from "./dto/credentialLogin.dto";
import { ChangeEmailDto } from "./dto/changeEmail.dto";
import { GoogleConfirmGuard } from "./guard/google-confirm.guard";
import { HandoffService } from './handoff/handoff.service';
import { AuthGuard as JwtAuthGuard } from './guard/auth.guard';
import { GetUser } from '../user/decorator/get-user.decorator';
import { GoogleStockGuard } from './guard/google-stock.guard';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly config: ConfigService,
        private readonly handoff: HandoffService,
    ) { }

    // دخول سريع لتطبيق المخزون: اللوحة تطلب رمزاً لمرة واحدة (60 ثانية)…
    @Post('handoff')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    createHandoff(@GetUser() user: any) {
        return this.handoff.create(String(user?.actorId || user?.id || user?.sub));
    }

    // …والتطبيق يستبدله بجلسة عادية
    @Post('handoff/redeem')
    @HttpCode(HttpStatus.OK)
    redeemHandoff(@Body('code') code: string) {
        return this.handoff.redeem(code);
    }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    login(@Body() dto: CredentialLoginDto) {
        return this.authService.credentialLogin(dto)
    }

    @Post('register')
    @HttpCode(HttpStatus.OK)
    register(@Body() dto: CreateUserDto) {
        return this.authService.register(dto)
    }

    @Post('resend-otp')
    @HttpCode(HttpStatus.OK)
    resendOtp(@Body('email') email: string) {
        return this.authService.resendOtp(email)
    }

    @Post('change-email')
    @HttpCode(HttpStatus.OK)
    changeEmail(@Body() dto: ChangeEmailDto) {
        return this.authService.changeUnverifiedEmail(dto)
    }

    @Post('verify-email')
    @HttpCode(HttpStatus.OK)
    verifyEmail(@Body() dto: VerifyEmailDto) {
        return this.authService.verifyEmail(dto)
    }

    @Post('forgot-password')
    @HttpCode(HttpStatus.OK)
    async forgotPassword(@Body('email') email: string) {
        return this.authService.forgotPassword(email);
    }

    @Post('verify-otp')
    @HttpCode(HttpStatus.OK)
    verifyOTP(@Body() dto: VerifyEmailDto) {
        return this.authService.verifyOTP(dto)
    }

    @Post('reset-password')
    @HttpCode(HttpStatus.OK)
    async resetPassword(@Body() dto: ResetPasswordDto) {
        return this.authService.resetPassword(dto);
    }

    @Get('google')
    @UseGuards(AuthGuard('google'))
    async googleAuth(@Req() req) { }

    @Get('google/callback')
    @UseGuards(AuthGuard('google' ))
    async googleAuthRedirect(@Req() req, @Res() res: Response) {
        // state=stock → تطبيق المخزون: رمز لمرة واحدة عبر /handoff (لا رمز جلسة في الرابط)
        if (req.query?.state === 'stock') {
            const stockUrl = this.config.get<string>('STOCK_URL') ?? 'https://stock.mdstore.top';
            try {
                const result = await this.authService.GoogleLogin(req.user);
                if (result && result.access_token) {
                    const { code } = await this.handoff.createForToken(result.access_token);
                    return (res as any).redirect(`${stockUrl}/handoff?code=${encodeURIComponent(code)}`);
                }
                return (res as any).redirect(`${stockUrl}/login?error=auth_failed`);
            } catch (error) {
                // لا حساب بهذا البريد ≠ خطأ عابر — رسالة مختلفة في التطبيق
                const reason = (error as any)?.status === 404 ? 'no_account' : 'google_auth_error';
                return (res as any).redirect(`${stockUrl}/login?error=${reason}`);
            }
        }
        // state=confirm → جاء من تطبيق التأكيد، فيُعاد إليه بدل لوحة التحكم
        if (req.query?.state === 'confirm') {
            const confirmUrl = this.config.get<string>('CONFIRM_URL') ?? 'http://localhost:3176';
            try {
                const result = await this.authService.GoogleLogin(req.user);
                if (result && result.access_token) {
                    return (res as any).redirect(`${confirmUrl}/auth/callback?token=${result.access_token}`);
                }
                return (res as any).redirect(`${confirmUrl}/login?error=auth_failed`);
            } catch (error) {
                return (res as any).redirect(`${confirmUrl}/login?error=google_auth_error`);
            }
        }
        try {
            const result = await this.authService.GoogleLogin(req.user);

            if (result && result.access_token) {
                const frontendUrl = `${this.config.get<string>('FRONT_URL')}/auth/callback?token=${result.access_token}`;
                return (res as any).redirect(frontendUrl);
            }

            return (res as any).redirect(`${this.config.get<string>('FRONT_URL')}/auth/login?error=auth_failed`);
        } catch (error) {
            return (res as any).redirect(`${this.config.get<string>('FRONT_URL')}/auth/login?error=google_auth_error`);
        }
    }

    // ── تطبيق المخزون (mdstore-stock): نفس استراتيجية google والرجوع، state=stock ──
    @Get('stock/google')
    @UseGuards(GoogleStockGuard)
    async googleStockAuth(@Req() req) { }

    // ── تطبيق التأكيد (confirm-app): نفس استراتيجية google، والرجوع إلى google/callback ──
    @Get('confirm/google')
    @UseGuards(GoogleConfirmGuard)
    async googleConfirmAuth(@Req() req) { }

    @Get('support/google')
    @UseGuards(AuthGuard('google-support'))
    async googleSupportAuth(@Req() req) { }

    @Get('support/google/callback')
    @UseGuards(AuthGuard('google-support'))
    async googleSupportAuthRedirect(@Req() req, @Res() res: Response) {
        try {
            const result = await this.authService.GoogleLogin(req.user);

            if (result && result.access_token) {
                const frontendUrl = `${this.config.get<string>('SUPPORT_URL')}/auth/callback?token=${result.access_token}`;
                return (res as any).redirect(frontendUrl);
            }

            return (res as any).redirect(`${this.config.get<string>('SUPPORT_URL')}/auth/login?error=auth_failed`);
        } catch (error) {
            return (res as any).redirect(`${this.config.get<string>('SUPPORT_URL')}/auth/login?error=google_auth_error`);
        }
    }
}