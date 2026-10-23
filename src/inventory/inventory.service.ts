import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { StatusEnum } from '../order/entities/order.entity';
import { orderStockDiff, StockLine } from './stock-reconcile';
import { StockReason } from './stock-movement.entity';

type Row = Record<string, any>;

@Injectable()
export class InventoryService {
  private readonly logger = new Logger('InventoryService');

  constructor(private readonly dataSource: DataSource) { }

  // ─── من الطلبات ────────────────────────────────────────────────────────────

  /** بعد أي تغيير على طلب (حالة أو عناصر أو حذف): يطبّق فرق المخزون فقط — بلا تكرار */
  async reconcileOrder(orderId: string, opts: { releaseAll?: boolean } = {}) {
    return this.dataSource.transaction(async (m) => {
      const [order] = await m.query(`SELECT id, status, "storeId" FROM orders WHERE id = $1 FOR UPDATE`, [orderId]);
      if (!order) return [];
      const items = opts.releaseAll ? [] : await m.query(
        `SELECT i."productId", i."variantDetailId", i.quantity, o.quantity AS "offerQty"
           FROM order_items i LEFT JOIN product_offers o ON o.id::text = i."offerId"::text
          WHERE i."orderId" = $1`, [orderId],
      );
      const recorded: StockLine[] = await m.query(
        `SELECT "productId", "variantDetailId", SUM(delta)::int AS delta
           FROM stock_movements WHERE "orderId" = $1 AND reason = 'order'
          GROUP BY "productId", "variantDetailId"`, [orderId],
      );
      const diff = orderStockDiff(
        opts.releaseAll ? StatusEnum.CANCELLED : order.status,
        items.map((i: Row) => ({ productId: String(i.productId), variantDetailId: i.variantDetailId ? String(i.variantDetailId) : null, quantity: Number(i.quantity), offer: i.offerQty ? { quantity: Number(i.offerQty) } : null })),
        recorded,
      );
      for (const d of diff) await this.apply(m, order.storeId, d, 'order', { orderId });
      return diff;
    });
  }

  /** لاستدعائه من مسارات الطلب: خطأ في المخزون لا يُفشل تغيير الحالة أبداً */
  async safeReconcile(orderId: string, opts?: { releaseAll?: boolean }) {
    try {
      await this.reconcileOrder(orderId, opts);
    } catch (err) {
      this.logger.error(`reconcile ${orderId}: ${(err as Error).message}`);
    }
  }

  private async apply(m: EntityManager, storeId: string, d: StockLine, reason: StockReason, extra: { orderId?: string; note?: string; userId?: string } = {}) {
    let stockAfter: number | null = null;
    // UPDATE … RETURNING في TypeORM/Postgres يرجع [rows, count]
    if (d.variantDetailId) {
      const [v] = await m.query(`UPDATE variant_details SET stock = stock + $2 WHERE id::text = $1 RETURNING stock`, [d.variantDetailId, d.delta]);
      stockAfter = v?.[0]?.stock ?? v?.stock ?? null;
    }
    if (stockAfter === null) {
      const [p] = await m.query(`UPDATE products SET stock = stock + $2 WHERE id::text = $1 RETURNING stock`, [d.productId, d.delta]);
      stockAfter = p?.[0]?.stock ?? p?.stock ?? null;
      if (stockAfter === null) return; // المنتج حُذف — لا شيء يُحدَّث
    }
    await m.query(
      `INSERT INTO stock_movements ("storeId", "productId", "variantDetailId", delta, "stockAfter", reason, "orderId", note, "userId")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [String(storeId), d.productId, d.variantDetailId, d.delta, Number(stockAfter), reason, extra.orderId ?? null, extra.note ?? null, extra.userId ?? null],
    );
  }

  /** تعديل حدث من صفحة المنتج: الرقم تغيّر هناك، هنا نسجّل الحركة فقط */
  async recordChange(storeId: string, productId: string, variantDetailId: string | null, before: number, after: number, userId?: string) {
    const delta = Number(after) - Number(before);
    if (!delta || !Number.isFinite(delta)) return;
    try {
      await this.dataSource.query(
        `INSERT INTO stock_movements ("storeId", "productId", "variantDetailId", delta, "stockAfter", reason, note, "userId")
         VALUES ($1, $2, $3, $4, $5, 'manual', $6, $7)`,
        [String(storeId), String(productId), variantDetailId, delta, Number(after), 'صفحة المنتج', userId ?? null],
      );
    } catch (err) {
      this.logger.error(`recordChange ${productId}: ${(err as Error).message}`);
    }
  }

  // ─── لوحة التاجر ───────────────────────────────────────────────────────────

  private async assertProduct(m: EntityManager, storeId: string, productId: string, variantId?: string | null) {
    const [p] = await m.query(`SELECT id FROM products WHERE id::text = $1 AND "storeId"::text = $2`, [productId, storeId]);
    if (!p) throw new NotFoundException('المنتج غير موجود');
    if (variantId) {
      const [v] = await m.query(`SELECT id FROM variant_details WHERE id::text = $1 AND "productId"::text = $2`, [variantId, productId]);
      if (!v) throw new NotFoundException('النسخة غير موجودة');
    }
  }

  /** توريد (+) أو تعديل يدوي إلى رقم محدد */
  async adjust(storeId: string, userId: string, dto: { productId: string; variantDetailId?: string | null; mode: 'add' | 'set'; quantity: number; note?: string }) {
    const qty = Math.trunc(Number(dto.quantity));
    if (!Number.isFinite(qty) || Math.abs(qty) > 1_000_000) throw new BadRequestException('كمية غير صالحة');
    if (dto.mode === 'set' && qty < 0) throw new BadRequestException('المخزون لا يكون سالباً');
    return this.dataSource.transaction(async (m) => {
      await this.assertProduct(m, storeId, dto.productId, dto.variantDetailId);
      const table = dto.variantDetailId ? 'variant_details' : 'products';
      const id = dto.variantDetailId || dto.productId;
      const [cur] = await m.query(`SELECT stock FROM ${table} WHERE id::text = $1 FOR UPDATE`, [id]);
      const delta = dto.mode === 'set' ? qty - Number(cur.stock) : qty;
      if (!delta) return { stock: Number(cur.stock), delta: 0 };
      await this.apply(m, storeId, { productId: dto.productId, variantDetailId: dto.variantDetailId || null, delta }, dto.mode === 'add' ? 'restock' : 'manual', { userId, note: dto.note?.slice(0, 255) });
      return { stock: Number(cur.stock) + delta, delta };
    });
  }

  async updateSettings(storeId: string, productId: string, dto: { lowStockThreshold?: number; costPrice?: number | null }) {
    const [p] = await this.dataSource.query(`SELECT id FROM products WHERE id::text = $1 AND "storeId"::text = $2`, [productId, storeId]);
    if (!p) throw new NotFoundException('المنتج غير موجود');
    const threshold = dto.lowStockThreshold === undefined ? null : Math.max(0, Math.trunc(Number(dto.lowStockThreshold) || 0));
    const cost = dto.costPrice === undefined ? undefined : dto.costPrice === null || dto.costPrice === ('' as any) ? null : Math.max(0, Number(dto.costPrice) || 0);
    await this.dataSource.query(
      `UPDATE products SET "lowStockThreshold" = COALESCE($2, "lowStockThreshold"), "costPrice" = CASE WHEN $4 THEN $3 ELSE "costPrice" END WHERE id::text = $1`,
      [productId, threshold, cost ?? null, cost !== undefined],
    );
    return { ok: true };
  }

  /** مسح الباركود: منتج بسيط، أو نسخة بعينها — داخل المتجر فقط */
  async findByBarcode(storeId: string, raw: string) {
    const code = String(raw || '').trim();
    if (!code) throw new NotFoundException('الباركود فارغ');
    const image = `(SELECT pi."imageUrl" FROM "product-images" pi WHERE pi."productId" = p.id LIMIT 1)`;
    const [v] = await this.dataSource.query(
      `SELECT v.id, v."productId", v.stock, v.name, v.barcode, p.name AS "productName", p.price AS "productPrice", p."lowStockThreshold", ${image} AS image
         FROM variant_details v JOIN products p ON p.id = v."productId"
        WHERE p."storeId"::text = $1 AND v.barcode = $2 AND p."deletedAt" IS NULL LIMIT 1`,
      [storeId, code],
    );
    if (v) {
      return {
        product: { id: v.productId, name: v.productName, price: Number(v.productPrice), image: v.image ?? null, lowStockThreshold: Number(v.lowStockThreshold ?? 5) },
        variant: {
          id: v.id, stock: Number(v.stock), barcode: v.barcode,
          parts: Array.isArray(v.name) ? v.name.map((a: Row) => ({ mode: a.displayMode || 'text', value: String(a.value ?? ''), attr: String(a.attrName ?? '') })) : [],
        },
      };
    }
    const [p] = await this.dataSource.query(
      `SELECT p.id, p.name, p.stock, p.price, p.barcode, p."lowStockThreshold", ${image} AS image
         FROM products p WHERE p."storeId"::text = $1 AND p.barcode = $2 AND p."deletedAt" IS NULL LIMIT 1`,
      [storeId, code],
    );
    if (!p) throw new NotFoundException('لا يوجد منتج بهذا الباركود');
    return {
      product: { id: p.id, name: p.name, stock: Number(p.stock), price: Number(p.price), barcode: p.barcode, image: p.image ?? null, lowStockThreshold: Number(p.lowStockThreshold ?? 5) },
      variant: null,
    };
  }

  /** الباركود فريد داخل المتجر (منتجات ونسخ) — عند الإنشاء والتعديل */
  async assertBarcodeFree(storeId: string, raw: string | null | undefined, exclude: { productId?: string; variantId?: string } = {}) {
    const code = String(raw ?? '').trim();
    if (!code) return;
    const [hit] = await this.dataSource.query(
      `SELECT 'p' AS k, p.id::text AS id FROM products p WHERE p."storeId"::text = $1 AND p.barcode = $2 AND p."deletedAt" IS NULL AND p.id::text <> $3
       UNION ALL
       SELECT 'v', v.id::text FROM variant_details v JOIN products p ON p.id = v."productId"
        WHERE p."storeId"::text = $1 AND v.barcode = $2 AND p."deletedAt" IS NULL AND v.id::text <> $4
       LIMIT 1`,
      [storeId, code, exclude.productId ?? '', exclude.variantId ?? ''],
    );
    if (hit) throw new ConflictException('هذا الباركود مستعمل لمنتج آخر في متجرك');
  }

  /** جدول المخزون: كل منتج ونسخه، الحالة، وقيمة المخزون */
  async overview(storeId: string) {
    const products: Row[] = await this.dataSource.query(
      `SELECT p.id, p.name, p.price, p.stock, p."lowStockThreshold", p."costPrice", p.barcode, p."categoryId",
              (SELECT pi."imageUrl" FROM "product-images" pi WHERE pi."productId" = p.id LIMIT 1) AS image
         FROM products p WHERE p."storeId"::text = $1 ORDER BY p.name`, [storeId],
    );
    const variants: Row[] = products.length ? await this.dataSource.query(
      `SELECT v.id, v."productId", v.name, v.price, v.stock, v.barcode FROM variant_details v
        WHERE v."productId"::text = ANY($1) AND v."isActive" = true`, [products.map((p) => String(p.id))],
    ) : [];
    const byProduct = new Map<string, Row[]>();
    for (const v of variants) byProduct.set(String(v.productId), [...(byProduct.get(String(v.productId)) ?? []), v]);

    const status = (stock: number, threshold: number) => (stock <= 0 ? 'out' : stock <= threshold ? 'low' : 'ok');
    let units = 0, valueSell = 0, valueCost = 0, low = 0, out = 0, hasCost = false;
    const rows = products.map((p) => {
      const threshold = Number(p.lowStockThreshold ?? 5);
      const cost = p.costPrice === null || p.costPrice === undefined ? null : Number(p.costPrice);
      const vs = (byProduct.get(String(p.id)) ?? []).map((v) => {
        // أجزاء النسخة كما يراها الزبون: نص يُكتب، صورة/لون يُعرضان (قيمتهما رابط أو كود لون، لا اسم)
        const parts = Array.isArray(v.name) ? v.name.map((a: Row) => ({ mode: a.displayMode || 'text', value: String(a.value ?? ''), attr: String(a.attrName ?? '') })) : [];
        const label = parts.length ? parts.map((x) => (x.mode === 'text' ? x.value : x.attr)).join(' / ') : String(v.name ?? '');
        return { id: v.id, label, parts, barcode: v.barcode ?? null, stock: Number(v.stock), price: Number(v.price) > 0 ? Number(v.price) : Number(p.price), status: status(Number(v.stock), threshold) };
      });
      const stock = vs.length ? vs.reduce((n, v) => n + v.stock, 0) : Number(p.stock);
      const lines = vs.length ? vs : [{ stock: Number(p.stock), price: Number(p.price) }];
      for (const l of lines) {
        const q = Math.max(0, l.stock);
        units += q;
        valueSell += q * l.price;
        if (cost !== null) { valueCost += q * cost; hasCost = true; }
      }
      const st = vs.length ? (vs.every((v) => v.status === 'out') ? 'out' : vs.some((v) => v.status !== 'ok') ? 'low' : 'ok') : status(stock, threshold);
      if (st === 'low') low++;
      if (st === 'out') out++;
      return { id: p.id, name: p.name, image: p.image ?? null, barcode: p.barcode ?? null, categoryId: p.categoryId ?? null, price: Number(p.price), costPrice: cost, lowStockThreshold: threshold, stock, status: st, variants: vs };
    });
    const round = (n: number) => Math.round(n * 100) / 100;
    return {
      products: rows,
      totals: { products: rows.length, units, low, out, valueSell: round(valueSell), valueCost: hasCost ? round(valueCost) : null },
    };
  }

  async movements(storeId: string, q: { productId?: string; page?: number; limit?: number }) {
    const limit = Math.min(100, Math.max(1, Number(q.limit) || 30));
    const page = Math.max(1, Number(q.page) || 1);
    const params: unknown[] = [storeId];
    let where = `m."storeId" = $1`;
    if (q.productId) { params.push(q.productId); where += ` AND m."productId" = $${params.length}`; }
    const [{ total }] = await this.dataSource.query(`SELECT count(*)::int AS total FROM stock_movements m WHERE ${where}`, params);
    const items = await this.dataSource.query(
      `SELECT m.id, m."productId", p.name AS "productName", m."variantDetailId", v.name AS "variantName",
              m.delta, m."stockAfter", m.reason, m."orderId", m.note, m."createdAt",
              u.username AS "userName"
         FROM stock_movements m
         LEFT JOIN products p ON p.id::text = m."productId"
         LEFT JOIN variant_details v ON v.id::text = m."variantDetailId"
         LEFT JOIN users u ON u.id::text = m."userId"
        WHERE ${where}
        ORDER BY m."createdAt" DESC
        LIMIT ${limit} OFFSET ${(page - 1) * limit}`, params,
    );
    return { items, total, page, limit };
  }
}
