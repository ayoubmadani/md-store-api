import { ForbiddenException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { randomInt, timingSafeEqual } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { Repository } from 'typeorm';
import { SuperAdmin } from './entity/super-admin.entity';
import { SA_ACCESS, SA_SESSION } from './guard/super-admin.guard';

const SESSION_TTL = '7d';
const ACCESS_TTL = '30m';
const CHALLENGE_TTL = '5m';
const SA_CHALLENGE = 'sa_pin_challenge';
const CHALLENGE_PARTS = 3; // 3 أسماء × رقمان = PIN من 6 أرقام
const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCK_MINUTES = 15;

@Injectable()
export class SuperAdminAuthService {
  constructor(
    @InjectRepository(SuperAdmin) private readonly admins: Repository<SuperAdmin>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) { }

  /**
   * الخطوة 1: Google ID token ← توكن جلسة (أسبوع) لمدير موجود في super_admins.
   * توكن الجلسة لا يفتح أي مسار غير PIN.
   */
  async googleLogin(credential: string) {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    let payload: any;
    try {
      const ticket = await new OAuth2Client(clientId).verifyIdToken({ idToken: credential, audience: clientId });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Invalid Google token');
    }
    if (!payload?.email || !payload.email_verified) {
      throw new UnauthorizedException('Google email not verified');
    }

    const admin = await this.admins.findOne({ where: { email: payload.email.toLowerCase(), isActive: true } });
    if (!admin) throw new ForbiddenException('هذا الحساب غير مصرح له بالدخول');

    const session_token = await this.jwt.signAsync({ sub: admin.id, typ: SA_SESSION }, { expiresIn: SESSION_TTL });
    return { session_token, email: admin.email, name: admin.name ?? payload.name };
  }

  /**
   * الخطوة 2: يختار 3 أسماء عشوائية مختلفة من SUPER_ADMIN_PINS، مثلاً ZZMMHH.
   * الرمز المطلوب (6 أرقام) = الرقمان 1-2 من رمز ZZ + الرقمان 3-4 من MM + الرقمان 5-6 من HH.
   */
  async pinChallenge(adminId: string) {
    const pool = [...this.pins().keys()];
    if (pool.length < CHALLENGE_PARTS) throw new InternalServerErrorException('SUPER_ADMIN_PINS يحتاج 3 رموز على الأقل');
    const labels: string[] = [];
    while (labels.length < CHALLENGE_PARTS) {
      labels.push(pool.splice(randomInt(pool.length), 1)[0]);
    }
    const challenge_token = await this.jwt.signAsync(
      { sub: adminId, typ: SA_CHALLENGE, labels },
      { expiresIn: CHALLENGE_TTL },
    );
    return { label: labels.join(''), challenge_token };
  }

  /**
   * الخطوة 3: الرمز المقابل للاسم المطلوب ← توكن دخول (30 دقيقة).
   * 5 محاولات خاطئة تقفل الإدخال 15 دقيقة.
   */
  async verifyPin(adminId: string, challengeToken: string, pin: string) {
    let challenge: any;
    try {
      challenge = await this.jwt.verifyAsync(challengeToken, { secret: this.config.get<string>('JWT_SECRET') });
    } catch {
      throw new UnauthorizedException('انتهت صلاحية الطلب، أعد المحاولة');
    }
    if (challenge?.typ !== SA_CHALLENGE || challenge.sub !== adminId) {
      throw new UnauthorizedException('انتهت صلاحية الطلب، أعد المحاولة');
    }

    const admin = await this.admins.findOne({ where: { id: adminId } });
    if (!admin) throw new UnauthorizedException();
    if (admin.pinLockedUntil && admin.pinLockedUntil > new Date()) {
      throw new ForbiddenException('محاولات كثيرة خاطئة، حاول بعد قليل');
    }

    const pins = this.pins();
    const parts = (Array.isArray(challenge.labels) ? challenge.labels : []).map(
      (label: string, i: number) => pins.get(label)?.slice(i * 2, i * 2 + 2),
    );
    const expected = parts.length === CHALLENGE_PARTS && parts.every((p) => p?.length === 2) ? parts.join('') : null;
    if (!expected || !safeEqual(pin, expected)) {
      const attempts = admin.pinAttempts + 1;
      const locked = attempts >= MAX_PIN_ATTEMPTS;
      await this.admins.update(admin.id, {
        pinAttempts: locked ? 0 : attempts,
        pinLockedUntil: locked ? new Date(Date.now() + PIN_LOCK_MINUTES * 60_000) : null,
      });
      throw new UnauthorizedException(locked ? 'محاولات كثيرة خاطئة، حاول بعد قليل' : 'رمز PIN غير صحيح');
    }

    if (admin.pinAttempts || admin.pinLockedUntil) {
      await this.admins.update(admin.id, { pinAttempts: 0, pinLockedUntil: null });
    }

    const access_token = await this.jwt.signAsync({ sub: admin.id, typ: SA_ACCESS }, { expiresIn: ACCESS_TTL });
    return { access_token };
  }

  // SUPER_ADMIN_PINS=ZZ:123456,SS:654321,...
  private pins(): Map<string, string> {
    const map = new Map<string, string>();
    for (const entry of (this.config.get<string>('SUPER_ADMIN_PINS') ?? '').split(',')) {
      const [label, code] = entry.split(':').map((v) => v?.trim());
      if (label && code) map.set(label, code);
    }
    if (!map.size) throw new InternalServerErrorException('SUPER_ADMIN_PINS غير مضبوط');
    return map;
  }
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
