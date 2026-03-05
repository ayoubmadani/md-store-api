import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { UserModule } from "../user/user.module"; 
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MailModule } from "../mail/mail.module";
import { PassportModule } from "@nestjs/passport"; // 2. استورد PassportModule
import { GoogleStrategy } from "./strategy/google.strategy";

@Module({
    imports: [
        MailModule,
        UserModule,
        PassportModule.register({ defaultStrategy: 'google' }), // 3. تسجيل Passport
        JwtModule.registerAsync({
            imports: [ConfigModule],
            global: true,
            inject: [ConfigService],
            useFactory: async (configService: ConfigService) => ({
                secret: configService.get<string>('JWT_SECRET'),
                signOptions: {
                    expiresIn: configService.get<any>('JWT_EXPIRESIN'),
                },
            }),
        }),
    ],
    controllers: [AuthController],
    providers: [
        AuthService, 
        GoogleStrategy // 4. هذا هو السطر الناقص الذي يحل المشكلة!
    ],
})
export class AuthModule {}