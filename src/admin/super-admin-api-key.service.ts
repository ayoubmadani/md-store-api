import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { SuperAdminApiKey } from './entity/super-admin-api-key.entity';
import { SuperAdmin } from './entity/super-admin.entity';
import { Theme } from '../theme/entities/theme.entity';
import { ThemeType } from '../theme/entities/theme-type.entity';
import { CreateThemeDto } from '../theme/dto/create-theme.dto';
import { HIDDEN_TYPE_NAMES } from '../theme/theme.constants';

export const SUPER_ADMIN_KEY_PREFIX = 'mdsa_';
const DEFAULT_EXPIRES_IN_DAYS = 30;

const hashKey = (key: string) => createHash('sha256').update(key).digest('hex');

@Injectable()
export class SuperAdminApiKeyService {
  constructor(
    @InjectRepository(SuperAdminApiKey) private readonly keys: Repository<SuperAdminApiKey>,
    @InjectRepository(SuperAdmin) private readonly admins: Repository<SuperAdmin>,
    @InjectRepository(Theme) private readonly themes: Repository<Theme>,
    @InjectRepository(ThemeType) private readonly types: Repository<ThemeType>,
  ) { }

  // يرجع المفتاح كاملاً هذه المرة فقط
  async create(superAdminId: string, name: string, expiresInDays = DEFAULT_EXPIRES_IN_DAYS) {
    const key = SUPER_ADMIN_KEY_PREFIX + randomBytes(32).toString('base64url');
    const saved = await this.keys.save(this.keys.create({
      superAdminId,
      name: name.trim(),
      keyHash: hashKey(key),
      prefix: key.slice(0, 9),
      expiresAt: new Date(Date.now() + expiresInDays * 86_400_000),
    }));
    return { id: saved.id, name: saved.name, key, prefix: saved.prefix, expiresAt: saved.expiresAt };
  }

  async findAll(superAdminId: string) {
    const rows = await this.keys.find({ where: { superAdminId }, order: { createdAt: 'DESC' } });
    return rows.map((k) => ({
      id: k.id, name: k.name, prefix: k.prefix, expiresAt: k.expiresAt, lastUsedAt: k.lastUsedAt, createdAt: k.createdAt,
      status: k.revokedAt ? 'revoked' : k.expiresAt.getTime() <= Date.now() ? 'expired' : 'active',
    }));
  }

  async revoke(superAdminId: string, id: string) {
    const key = await this.keys.findOne({ where: { id, superAdminId } });
    if (!key) throw new NotFoundException('المفتاح غير موجود');
    if (!key.revokedAt) await this.keys.update(key.id, { revokedAt: new Date() });
    return { success: true };
  }

  // المدير صاحب المفتاح — يُرفض المفتاح الملغى أو المنتهي أو مدير معطّل
  async verify(key: string): Promise<SuperAdmin> {
    const row = await this.keys.findOne({ where: { keyHash: hashKey(key) }, relations: ['superAdmin'] });
    if (!row || row.revokedAt || row.expiresAt.getTime() <= Date.now() || !row.superAdmin?.isActive) {
      throw new UnauthorizedException('Invalid admin key');
    }
    await this.keys.update(row.id, { lastUsedAt: new Date() });
    return row.superAdmin;
  }

  /* عمليات MCP (بعد التحقق من PIN في المتحكم) */

  // hidden = نوع لا يظهر للتجار في معرض الثيمات (custom، testing)
  async listThemeTypes() {
    const rows = await this.types.find({ order: { name: 'ASC' } });
    return rows.map((t) => ({ id: t.id, name: t.name, hidden: HIDDEN_TYPE_NAMES.includes(t.name) }));
  }

  async createThemeType(name: string) {
    const clean = name.trim();
    const exists = await this.types
      .createQueryBuilder('t')
      .where('LOWER(t.name) = LOWER(:name)', { name: clean })
      .getOne();
    if (exists) throw new BadRequestException(`النوع «${exists.name}» موجود من قبل`);
    return this.types.save(this.types.create({ name: clean }));
  }

  async createTheme(dto: CreateThemeDto) {
    const slug = dto.slug.trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)) throw new BadRequestException('slug غير صالح (حروف وأرقام وشرطات فقط)');
    if (await this.themes.findOne({ where: { slug } })) throw new BadRequestException('هذا الـ slug مستعمل من قبل');
    if (dto.typeId && !(await this.types.findOne({ where: { id: dto.typeId } }))) {
      throw new BadRequestException('نوع الثيم غير موجود');
    }
    // يُنشأ غير مفعّل: يُفعَّل من لوحة الأدمن بعد رفع ملف الثيم
    return this.themes.save(this.themes.create({ ...dto, slug, isActive: false } as any));
  }
}
