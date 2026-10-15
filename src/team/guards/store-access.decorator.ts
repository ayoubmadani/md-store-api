import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { StorePermission } from '../permissions';
import { StoreAccessGuard } from './store-access.guard';

// من أين يُعرف المتجر في هذا المسار
export type StoreRef =
  | { param: string }                                  // /stores/:storeId/...
  | { body: string }                                   // { storeId } في الـ body
  | { entity: 'order' | 'domain'; param: string };     // يُستنتج من صف (طلب، دومين)

export interface StoreAccessMeta {
  permission: StorePermission | null; // null = أي عضو مقبول (قراءة عامة للمتجر)
  ownerOnly: boolean;
  store: StoreRef;
}

export const STORE_ACCESS_KEY = 'store_access';

/**
 * مسار خاص بمتجر: المالك يمر دائماً، والعضو يحتاج: خطة المالك نشطة ← عضوية مقبولة ← غير معلّق ← مجموعة مفعّلة ← الصلاحية.
 * الحارس يتولى المصادقة أيضاً (يرث AuthGuard)، فلا حاجة لـ @UseGuards(AuthGuard) معه.
 */
export const RequirePermission = (permission: StorePermission | null, store: StoreRef = { param: 'storeId' }) =>
  applyDecorators(
    SetMetadata(STORE_ACCESS_KEY, { permission, ownerOnly: false, store } as StoreAccessMeta),
    UseGuards(StoreAccessGuard),
  );

/** للمالك وحده: حذف المتجر، الفريق والمجموعات، سجل النشاط، الاشتراك والفوترة */
export const OwnerOnly = (store: StoreRef = { param: 'storeId' }) =>
  applyDecorators(
    SetMetadata(STORE_ACCESS_KEY, { permission: null, ownerOnly: true, store } as StoreAccessMeta),
    UseGuards(StoreAccessGuard),
  );
