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

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly config: ConfigService
    ) { }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    login(@Body() dto: CredentialLoginDto) {
        return this.authService.credentialLogin(dto)
    }

    // لوحة الأدمن: Google ID token ← توكن API لحساب ADMIN فقط
    @Post('admin/google')
    @HttpCode(HttpStatus.OK)
    adminGoogleLogin(@Body('credential') credential: string) {
        if (!credential) throw new BadRequestException('credential is required');
        return this.authService.adminGoogleLogin(credential)
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