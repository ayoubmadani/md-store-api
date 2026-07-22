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
            useFactory: (config: ConfigService) => {
                const port = Number(config.get('MAIL_PORT')) || 465;
                return {
                transport: {
                    host: config.get('MAIL_HOST'),
                    port,
                    secure: port === 465, // SSL للمنفذ 465، STARTTLS لغير ذلك
                    auth: {
                        user: config.get('MAIL_USER'),
                        pass: config.get('MAIL_PASS'),
                    },
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
                };
            },
        }),
    ],
    providers: [MailService],
    exports: [MailService],
})
export class MailModule { }