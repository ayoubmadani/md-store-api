import { Module } from "@nestjs/common";
import { MailService } from "./mail.service";
import { MailerModule } from "@nestjs-modules/mailer";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { join } from 'path';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';

@Module({
    imports: [
        MailerModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                transport: {
                    host: config.get('MAIL_HOST'),
                    port: 587,
                    secure: false, // يجب أن تكون false للمنفذ 587
                    auth: {
                        user: config.get('MAIL_USER'), // هنا سيستخدم a0f3c4001@smtp-brevo.com
                        pass: config.get('MAIL_PASS'),
                    },
                    // أضف هذا الجزء لضمان التوافق مع Brevo
                    tls: {
                        rejectUnauthorized: false
                    }
                },
                defaults: {
                    from: `"${config.get('APP_NAME')}" <${config.get('MAIL_FROM')}>`,
                },
                template: {
                    dir: join(__dirname, 'templates'), // تأكد من وجود مجلد templates داخل src/mail
                    adapter: new HandlebarsAdapter(),
                    options: { strict: true },
                },
            }),
        }),
    ],
    providers: [MailService],
    exports: [MailService],
})
export class MailModule { }