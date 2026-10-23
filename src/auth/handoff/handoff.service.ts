import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { createHash, randomBytes } from 'crypto';

const TTL_SECONDS = 60;
const hash = (code: string) => createHash('sha256').update(code).digest('hex');

// دخول سريع من لوحة التاجر إلى تطبيق آخر للمنصة (تطبيق المخزون):
// رمز عشوائي لمرة واحدة صالح 60 ثانية — يُحفظ مُشفَّراً فقط، ولا يمرّ رمز الجلسة الحقيقي في الرابط.
@Injectable()
export class HandoffService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly jwt: JwtService,
  ) { }

  async create(userId: string) {
    const code = randomBytes(32).toString('base64url');
    await this.dataSource.query(
      `INSERT INTO auth_handoffs ("codeHash", "userId", "expiresAt") VALUES ($1, $2, $3)`,
      [hash(code), String(userId), new Date(Date.now() + TTL_SECONDS * 1000)],
    );
    return { code, expiresIn: TTL_SECONDS };
  }

  /** بعد دخول Google: رمز لمرة واحدة لصاحب جلسة صالحة — بدل وضع رمز الجلسة في رابط الرجوع */
  async createForToken(accessToken: string) {
    let sub: string | undefined;
    try {
      sub = (await this.jwt.verifyAsync(accessToken))?.sub;
    } catch {
      sub = undefined;
    }
    if (!sub) throw new UnauthorizedException('جلسة غير صالحة');
    return this.create(String(sub));
  }

  async redeem(code: string) {
    // ذرّي: استبدالان متزامنان لنفس الرمز — ينجح واحد فقط
    const [rows] = await this.dataSource.query(
      `UPDATE auth_handoffs SET "usedAt" = now()
        WHERE "codeHash" = $1 AND "usedAt" IS NULL AND "expiresAt" > now()
        RETURNING "userId"`,
      [hash(String(code || ''))],
    );
    const userId = rows?.[0]?.userId;
    if (!userId) throw new UnauthorizedException('رابط الدخول غير صالح أو انتهت صلاحيته');
    const [user] = await this.dataSource.query(`SELECT role FROM users WHERE id::text = $1`, [userId]);
    if (!user) throw new UnauthorizedException('الحساب غير موجود');
    return { access_token: await this.jwt.signAsync({ sub: userId, role: user.role }), success: true };
  }
}
