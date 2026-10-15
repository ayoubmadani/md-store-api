import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { AuthGuard } from '../../auth/guard/auth.guard';
import { ApiKeyService } from '../../api-key/api-key.service';
import { AccessError } from '../permissions';
import { ownerMemberLimit } from '../member-limit';
import { STORE_ACCESS_KEY, StoreAccessMeta, StoreRef } from './store-access.decorator';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ENTITY_TABLE: Record<string, string> = { order: 'orders', domain: 'domains' };

export interface StoreAccess {
  storeId: string;
  ownerId: string;
  actorId: string; // من يقوم بالعمل فعلاً (للسجل)
  role: 'owner' | 'member';
  permissions: string[];
}

const deny = (code: AccessError, message: string) => new ForbiddenException({ statusCode: 403, code, message });

/**
 * يرث AuthGuard: يصادق إن لم يصادَق الطلب بعد، ثم يتحقق من الوصول للمتجر.
 * العضو المسموح له يُكمل الطلب «باسم المالك» (request.user = المالك) فتعمل خدمات المتجر الحالية كما هي
 * وتُحسب كل الحدود من خطة المالك، مع حفظ هوية العضو في request.storeAccess.actorId للسجل.
 */
@Injectable()
export class StoreAccessGuard extends AuthGuard {
  constructor(
    jwtService: JwtService,
    config: ConfigService,
    private readonly reflectorRef: Reflector,
    apiKeyService: ApiKeyService,
    private readonly dataSource: DataSource,
  ) {
    super(jwtService, config, reflectorRef, apiKeyService);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    if (!req.user) await super.canActivate(context);

    const meta = this.reflectorRef.getAllAndOverride<StoreAccessMeta>(STORE_ACCESS_KEY, [context.getHandler(), context.getClass()]);
    if (!meta) return true;

    // إن مرّ الطلب بحارس سابق وصار «باسم المالك»، نتحقق دائماً بهوية الفاعل الحقيقي
    const userId: string | undefined = req.user?.actorId || req.user?.id || req.user?.sub;
    const storeId = await this.resolveStoreId(req, meta.store);
    // متجر/صف غير موجود: نترك الخدمة ترد كما اليوم (404)
    if (!userId || !storeId) return true;
    const [store] = await this.dataSource.query(`SELECT "userId" FROM stores WHERE id = $1`, [storeId]);
    if (!store) return true;

    const ownerId: string = store.userId;
    if (ownerId === userId) {
      req.storeAccess = { storeId, ownerId, actorId: userId, role: 'owner', permissions: ['*'] } as StoreAccess;
      return true;
    }

    const [m] = await this.dataSource.query(
      `SELECT m.status, m."suspendedByPlan", m."groupId", g."isActive" AS "groupActive", g.permissions
         FROM store_members m LEFT JOIN store_groups g ON g.id = m."groupId"
        WHERE m."storeId" = $1 AND m."userId" = $2`,
      [storeId, userId],
    );
    if (!m) throw deny(AccessError.NOT_A_MEMBER, 'لست عضواً في فريق هذا المتجر');
    if (meta.ownerOnly) throw deny(AccessError.OWNER_ONLY, 'هذه العملية لصاحب المتجر فقط');

    // بالترتيب: خطة المالك ← العضوية ← التعليق ← المجموعة ← الصلاحية
    const limit = await ownerMemberLimit(this.dataSource, ownerId);
    if (!limit) throw deny(AccessError.PLAN_EXPIRED, 'اشتراك صاحب المتجر لا يسمح بمشاركة المتجر حالياً');
    if (m.status !== 'accepted') throw deny(AccessError.NOT_A_MEMBER, 'لم تقبل دعوة هذا المتجر بعد');
    if (m.suspendedByPlan) throw deny(AccessError.MEMBER_SUSPENDED, 'عضويتك معلّقة لأن خطة صاحب المتجر لا تتسع لكل الأعضاء');
    if (!m.groupId) throw deny(AccessError.NO_GROUP, 'بانتظار أن يسندك صاحب المتجر لمجموعة');
    if (!m.groupActive) throw deny(AccessError.GROUP_DISABLED, 'مجموعتك في هذا المتجر معطّلة');
    const permissions: string[] = m.permissions ?? [];
    if (meta.permission && !permissions.includes(meta.permission)) {
      throw deny(AccessError.PERMISSION_DENIED, 'ليست لديك صلاحية لهذه العملية');
    }

    req.storeAccess = { storeId, ownerId, actorId: userId, role: 'member', permissions } as StoreAccess;
    req.user = { ...req.user, id: ownerId, sub: ownerId, userId: ownerId, actorId: userId, actingAsMember: true };
    // ملاحظة: المالك نفسه لا يُعاد كتابة req.user له، فـ actorId غير موجود ويُستعمل id
    return true;
  }

  private async resolveStoreId(req: any, ref: StoreRef): Promise<string | null> {
    let value: string | undefined;
    if ('entity' in ref) {
      const id = req.params?.[ref.param];
      if (!id || !UUID.test(id)) return null;
      const [row] = await this.dataSource.query(`SELECT "storeId" FROM "${ENTITY_TABLE[ref.entity]}" WHERE id = $1`, [id]);
      value = row?.storeId;
    } else if ('param' in ref) {
      value = req.params?.[ref.param];
    } else {
      value = req.body?.[ref.body];
    }
    return value && UUID.test(String(value)) ? String(value) : null;
  }
}
