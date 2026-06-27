import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';
import { AuthProvider } from '../../user/entities/user.entity';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleSupportStrategy extends PassportStrategy(Strategy, 'google-support') {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID'),
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET'),
      callbackURL: `${configService.get<string>('GOOGLE_SUPORT_CALLBACK_URL')}`,
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
    done(null, user);
  }
}
