import { StatusEnum } from '../order/entities/order.entity';

/**
 * تحويل حالة الطرد كما ترجعها شركة التوصيل إلى حالة الطلب عندنا.
 * محافظ عمداً: فقط الحالات النهائية الصريحة (تم التسليم / رجع للبائع).
 * أي حالة أخرى (في الطريق، محاولة فاشلة، في طريق الإرجاع...) → null فيبقى الطلب "قيد الشحن".
 * العمولة تعتمد على هذا، فالخطأ هنا أخطر من التأخير.
 */

// الحقول التي تضع فيها الشركات حالة الطرد
// Yalidine: last_status — ZR Express (Procolis): Situation — Maystro/أخرى: status_display/status...
const STATUS_FIELDS = ['last_status', 'Situation', 'situation', 'status_display', 'status_name', 'Statut', 'statut', 'state', 'status'];

const normalize = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '') // é → e
    .toLowerCase().replace(/['’]/g, ' ').replace(/\s+/g, ' ').trim();

const DELIVERED = new Set(['livre', 'livree', 'delivered', 'livraison effectuee', 'colis livre', 'تم التسليم', 'مسلم']);
const RETURNED = new Set([
  'retourne au vendeur', 'retournee au vendeur', 'retour vendeur', 'retourne a l expediteur',
  'retour recu', 'retour livre au vendeur', 'returned', 'returned to sender', 'مرتجع',
]);

/** النص الخام لحالة الطرد (للحفظ والعرض) */
export function rawProviderStatus(order: Record<string, unknown> | null | undefined): string | null {
  if (!order || typeof order !== 'object') return null;
  for (const field of STATUS_FIELDS) {
    const value = order[field];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

export function mapProviderStatus(raw: string | null): StatusEnum.DELIVERED | StatusEnum.RETURNED | null {
  if (!raw) return null;
  const s = normalize(raw);
  if (DELIVERED.has(s)) return StatusEnum.DELIVERED;
  if (RETURNED.has(s)) return StatusEnum.RETURNED;
  return null;
}
