import { applyDecorators, CallHandler, ExecutionContext, Injectable, NestInterceptor, SetMetadata, UseInterceptors } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { from, Observable, switchMap } from 'rxjs';
import { ActivityService, ENTITY_SOURCES } from './activity.service';
import { ActivityAction, ActivityEntity } from './entities/store-activity.entity';
import { StoreAccess } from './guards/store-access.guard';

// معرّف الكيان: من param، أو من ردّ الإنشاء، أو المتجر نفسه (إعدادات المتجر/الثيم)
export type ActivityIdFrom = { param: string } | { response: true } | { store: true };

interface ActivityMeta { entity: ActivityEntity; action: ActivityAction; id: ActivityIdFrom }
const ACTIVITY_KEY = 'store_activity';

/** يسجّل العملية في سجل نشاط المتجر (قبل/بعد) — يُستعمل مع @RequirePermission على نفس المسار */
export const LogActivity = (entity: ActivityEntity, action: ActivityAction, id: ActivityIdFrom) =>
  applyDecorators(SetMetadata(ACTIVITY_KEY, { entity, action, id } as ActivityMeta), UseInterceptors(ActivityInterceptor));

// معرّفات الكيانات التي أنشأها المسار من ردّه (كائن، أو { data }، أو مصفوفة)
function idsFromResponse(res: any): string[] {
  const pick = (x: any) => x?.id ?? x?.data?.id ?? x?.product?.id ?? x?.category?.id ?? x?.domain?.id;
  if (Array.isArray(res)) return res.map(pick).filter(Boolean);
  if (Array.isArray(res?.data)) return res.data.map(pick).filter(Boolean);
  const one = pick(res);
  return one ? [one] : [];
}

@Injectable()
export class ActivityInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector, private readonly activity: ActivityService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const meta = this.reflector.get<ActivityMeta>(ACTIVITY_KEY, context.getHandler());
    const req = context.switchToHttp().getRequest();
    const access: StoreAccess | undefined = req.storeAccess;
    if (!meta || !access) return next.handle();

    const entityId: string | undefined = 'param' in meta.id ? req.params?.[meta.id.param] : 'store' in meta.id ? access.storeId : undefined;
    const before = entityId && meta.action !== 'create' ? await this.activity.snapshot(meta.entity, entityId).catch(() => null) : null;

    return next.handle().pipe(switchMap((result) => from(this.record(meta, access, entityId, before, result).then(() => result))));
  }

  private async record(meta: ActivityMeta, access: StoreAccess, entityId: string | undefined, before: any, result: any) {
    try {
      const base = { storeId: access.storeId, userId: access.actorId, entity: meta.entity };
      if (meta.action === 'create') {
        for (const id of idsFromResponse(result)) {
          const after = await this.activity.snapshot(meta.entity, id);
          await this.activity.logSafe({ ...base, action: 'create', entityId: id, entityName: this.activity.nameOf(meta.entity, after), after });
        }
        return;
      }
      if (!entityId) return;
      const after = await this.activity.snapshot(meta.entity, entityId);

      if (meta.action === 'delete') {
        // حذف ناعم: من حذف
        if (ENTITY_SOURCES[meta.entity]?.softDelete && after?.deletedAt) await this.activity.markDeletedBy(meta.entity, entityId, access.actorId);
        await this.activity.logSafe({ ...base, action: 'delete', entityId, entityName: this.activity.nameOf(meta.entity, before), before, after: null });
        return;
      }

      const changes = this.activity.diff(before, after);
      if (!changes) return; // لا تغيير فعلي
      await this.activity.logSafe({
        ...base, action: meta.action === 'restore' ? 'restore' : 'update', entityId, entityName: this.activity.nameOf(meta.entity, after ?? before),
        before: changes.before, after: changes.after,
      });
    } catch (err: any) {
      console.error('[activity] record failed', meta.entity, meta.action, err?.message);
    }
  }
}
