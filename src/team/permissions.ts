// صلاحيات أعضاء فريق المتجر. ما يخص المالك وحده (حذف المتجر، الفريق والمجموعات، سجل النشاط، الاشتراك والفوترة)
// ليس صلاحية ولا يمكن منحه لأحد.
export enum StorePermission {
  STORE_UPDATE = 'store.update',
  THEME_CHANGE = 'theme.change',
  PRODUCT_CRUD = 'product.crud',
  CATEGORY_CRUD = 'category.crud',
  ORDER_VIEW = 'order.view',
  ORDER_MANAGE = 'order.manage',
  DOMAIN_CRUD = 'domain.crud',
  SEO_MANAGE = 'seo.manage',
}

export const ALL_PERMISSIONS = Object.values(StorePermission) as string[];

// order.manage يستلزم order.view — يُضاف تلقائياً عند الحفظ
export function normalizePermissions(perms: string[]): StorePermission[] {
  const set = new Set(perms.filter((p) => ALL_PERMISSIONS.includes(p)) as StorePermission[]);
  if (set.has(StorePermission.ORDER_MANAGE)) set.add(StorePermission.ORDER_VIEW);
  return ALL_PERMISSIONS.filter((p) => set.has(p as StorePermission)) as StorePermission[];
}

// رموز رفض الوصول (403) — لوحة التحكم تعيد التوجيه لقائمة المتاجر عند أي منها
export enum AccessError {
  NOT_A_MEMBER = 'NOT_A_MEMBER',
  PLAN_EXPIRED = 'PLAN_EXPIRED',
  MEMBER_SUSPENDED = 'MEMBER_SUSPENDED',
  GROUP_DISABLED = 'GROUP_DISABLED',
  NO_GROUP = 'NO_GROUP', // عضو مقبول لم يُسند لمجموعة بعد
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  OWNER_ONLY = 'OWNER_ONLY',
}
