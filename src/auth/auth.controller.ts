import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Post, Req, Res, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { CreateUserDto } from "../user/dto/create-user.dto";
import { VerifyEmailDto } from "./dto/verifyEmail.dto";
import { ResetPasswordDto } from "./dto/resetPassword";
import { AuthGuard } from "@nestjs/passport";
import * as express from 'express';
import { ConfigService } from "@nestjs/config";
import { CredentialLoginDto } from "./dto/credentialLogin.dto";

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

    // 5. تنفيذ تغيير كلمة المرور باستخدام الرمز
    @Post('reset-password')
    @HttpCode(HttpStatus.OK)
    async resetPassword(@Body() dto: ResetPasswordDto) {
        return this.authService.resetPassword(dto);
    }

    @Get('google')
    @UseGuards(AuthGuard('google'))
    async googleAuth(@Req() req) { }

    @Get('google/callback')
    @UseGuards(AuthGuard('google'))
    // 2. استخدم express.Response بدلاً من Response فقط
    async googleAuthRedirect(@Req() req, @Res() res: express.Response) {
        try {
            const result = await this.authService.GoogleLogin(req.user);

            if (result && result.access_token) {
                const frontendUrl = `${this.config.get<string>('FRONT_URL')}/auth/callback?token=${result.access_token}`;
                return res.redirect(frontendUrl);
            }

            return res.redirect(`${this.config.get<string>('FRONT_URL')}/auth/login?error=auth_failed`);
        } catch (error) {
            return res.redirect(`${this.config.get<string>('FRONT_URL')}/auth/login?error=google_auth_error`);
        }
    }



}