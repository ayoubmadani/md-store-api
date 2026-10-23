import { UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { HandoffService } from './handoff.service';

// قاعدة وهمية: تحاكي UPDATE … WHERE usedAt IS NULL AND expiresAt > now() RETURNING
function setup() {
  const rows: any[] = [];
  const ds = {
    query: jest.fn(async (sql: string, p: any[]) => {
      if (/^INSERT/i.test(sql.trim())) { rows.push({ codeHash: p[0], userId: p[1], expiresAt: p[2], usedAt: null }); return []; }
      if (/^UPDATE/i.test(sql.trim())) {
        const r = rows.find((x) => x.codeHash === p[0] && !x.usedAt && x.expiresAt > new Date());
        if (!r) return [[], 0];
        r.usedAt = new Date();
        return [[{ userId: r.userId }], 1];
      }
      if (/FROM users/i.test(sql)) return [{ role: 'user' }];
      return [];
    }),
  };
  const jwt = { signAsync: jest.fn(async (payload: any) => `jwt:${payload.sub}:${payload.role}`) };
  return { svc: new HandoffService(ds as any, jwt as any), rows };
}

describe('HandoffService', () => {
  it('creates a random code and stores only its hash, valid 60s', async () => {
    const { svc, rows } = setup();
    const { code, expiresIn } = await svc.create('u1');
    expect(code).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(expiresIn).toBe(60);
    expect(rows[0].codeHash).toBe(createHash('sha256').update(code).digest('hex'));
    expect(rows[0].codeHash).not.toContain(code);
  });

  it('redeems once into a normal login token', async () => {
    const { svc } = setup();
    const { code } = await svc.create('u1');
    expect(await svc.redeem(code)).toEqual({ access_token: 'jwt:u1:user', success: true });
    await expect(svc.redeem(code)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('expired or unknown code is rejected', async () => {
    const { svc, rows } = setup();
    const { code } = await svc.create('u1');
    rows[0].expiresAt = new Date(Date.now() - 1000);
    await expect(svc.redeem(code)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(svc.redeem('nope')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
