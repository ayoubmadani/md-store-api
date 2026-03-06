import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';
import { AuthProvider } from '../../user/entities/user.entity';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private authService: AuthService,
    private configService: ConfigService // تصحيح الاسم والترتيب
  ) {
    super({
      // استخدام configService بدلاً من process.env مباشرة
      clientID: configService.get<string>('GOOGLE_CLIENT_ID'),
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: 'http://localhost:7000/auth/google/callback',
      scope: ['email', 'profile'],
    } as any);
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { name, emails, photos } = profile;

    const googleUser = {
      email: emails[0].value,
      username: `${name.givenName} ${name.familyName}`,
      image: photos[0].value,
      provider: AuthProvider.GOOGLE,
    };

    const user = await this.authService.validateGoogleUser(googleUser);

    // في Passport، نمرر المستخدم لـ done لكي يتم وضعه في req.user
    done(null, user);
  }
}