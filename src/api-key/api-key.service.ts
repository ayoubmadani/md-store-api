import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { ApiKey } from './entities/api-key.entity';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

export const API_KEY_PREFIX = 'mdk_';
const DEFAULT_EXPIRES_IN_DAYS = 90;

export type ApiKeyStatus = 'active' | 'expired' | 'revoked';

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

function statusOf(apiKey: ApiKey): ApiKeyStatus {
  if (apiKey.revokedAt) return 'revoked';
  if (apiKey.expiresAt.getTime() <= Date.now()) return 'expired';
  return 'active';
}

@Injectable()
export class ApiKeyService {
  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepo: Repository<ApiKey>,
  ) {}

  // يرجع المفتاح كاملاً هذه المرة فقط — بعدها لا يبقى منه إلا بصمته.
  async create(userId: string, dto: CreateApiKeyDto) {
    const key = API_KEY_PREFIX + randomBytes(32).toString('base64url');
    const days = dto.expiresInDays ?? DEFAULT_EXPIRES_IN_DAYS;

    const saved = await this.apiKeyRepo.save(
      this.apiKeyRepo.create({
        userId,
        name: dto.name,
        keyHash: hashKey(key),
        prefix: key.slice(0, 8),
        expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
      }),
    );

    return { id: saved.id, name: saved.name, key, prefix: saved.prefix, expiresAt: saved.expiresAt };
  }

  async findAll(userId: string) {
    const keys = await this.apiKeyRepo.find({ where: { userId }, order: { createdAt: 'DESC' } });
    return keys.map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.prefix,
      status: statusOf(k),
      lastUsedAt: k.lastUsedAt,
      connectedClient: k.connectedClient,
      connectedAt: k.connectedAt,
      expiresAt: k.expiresAt,
      createdAt: k.createdAt,
    }));
  }

  async revoke(userId: string, id: string) {
    const apiKey = await this.apiKeyRepo.findOne({ where: { id, userId } });
    if (!apiKey) throw new NotFoundException('المفتاح غير موجود');
    if (!apiKey.revokedAt) {
      apiKey.revokedAt = new Date();
      await this.apiKeyRepo.save(apiKey);
    }
    return { success: true };
  }

  // يرجع نفس شكل payload الـ JWT ({ sub, role }) حتى تعمل المسارات
  // الحالية (getUserId، GetUser...) بدون أي تعديل.
  async verify(key: string): Promise<{ sub: string; role: string; apiKeyId: string }> {
    const apiKey = await this.apiKeyRepo.findOne({
      where: { keyHash: hashKey(key) },
      relations: ['user'],
    });

    if (!apiKey) throw new UnauthorizedException('Invalid API key');
    const status = statusOf(apiKey);
    if (status === 'revoked') throw new UnauthorizedException('API key has been revoked');
    if (status === 'expired') throw new UnauthorizedException('API key has expired');

    await this.apiKeyRepo.update(apiKey.id, { lastUsedAt: new Date() });

    return { sub: apiKey.userId, role: apiKey.user.role, apiKeyId: apiKey.id };
  }

  // يسجّله خادم MCP عند بداية الربط (initialize) — على المفتاح المستعمل نفسه فقط
  async markConnected(apiKeyId: string, client: string) {
    const name = (client || '').trim().slice(0, 100) || 'mcp';
    await this.apiKeyRepo.update(apiKeyId, { connectedClient: name, connectedAt: new Date() });
    return { success: true };
  }
}
