import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { DataSource, In, LessThanOrEqual, Repository } from 'typeorm';
import { PaymentService } from '../payment/payment.service';
import { TransactionType } from '../payment/entities/transaction.entity';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';
import { Store } from '../store/entities/store.entity';
import { Theme } from '../theme/entities/theme.entity';
import { ThemeType } from '../theme/entities/theme-type.entity';
import { ThemeUser } from '../theme/entities/theme-user.entity';
import { ThemeCodeService } from '../admin/theme-code.service';
import { CustomThemeGenerator, GenerationInput, StoreBrief } from './custom-theme-generator';
import { CustomThemeJob } from './entities/custom-theme-job.entity';
import { CustomThemeOrder } from './entities/custom-theme-order.entity';

const MAX_ATTEMPTS = 3;            // الطلب الأول + إصلاحان لأخطاء البناء
const CHECK_INTERVAL_MS = 30_000;  // لا نسأل Claude عن نفس الطلب أكثر من مرة كل 30 ثانية
const ACTIVE: CustomThemeJob['status'][] = ['queued', 'review'];

@Injectable()
export class CustomThemeService {
  private readonly logger = new Logger(CustomThemeService.name);

  constructor(
    @InjectRepository(CustomThemeOrder) private readonly orders: Repository<CustomThemeOrder>,
    @InjectRepository(CustomThemeJob) private readonly jobs: Repository<CustomThemeJob>,
    @InjectRepository(Store) private readonly stores: Repository<Store>,
    @InjectRepository(Theme) private readonly themes: Repository<Theme>,
    @InjectRepository(ThemeType) private readonly types: Repository<ThemeType>,
    @InjectRepository(ThemeUser) private readonly themeUsers: Repository<ThemeUser>,
    private readonly dataSource: DataSource,
    private readonly payment: PaymentService,
    private readonly settings: PlatformSettingsService,
    private readonly generator: CustomThemeGenerator,
    private readonly themeCode: ThemeCodeService,
  ) { }

  /* ─── التاجر ─────────────────────────────────────────────────────────── */

  async config() {
    const s = await this.settings.getAll();
    return {
      enabled: s.customThemeEnabled,
      price: s.customThemePrice,
      revisions: s.customThemeRevisions,
      revisionPrice: s.customThemeRevisionPrice,
      delayHours: s.customThemeDelayHours,
    };
  }

  async listMine(userId: string) {
    const rows = await this.orders.find({ where: { userId }, relations: ['store', 'jobs'], order: { createdAt: 'DESC' } });
    await this.syncJobs(rows.flatMap((o) => o.jobs ?? []));
    const fresh = await this.orders.find({ where: { userId }, relations: ['store', 'jobs'], order: { createdAt: 'DESC' } });
    return fresh.map((o) => this.view(o));
  }

  /** شراء ثيم خاص: يُخصم السعر من المحفظة ويُرسل الطلب لـ Claude */
  async create(userId: string, storeId: string, request: string) {
    const cfg = await this.config();
    if (!cfg.enabled) throw new ForbiddenException('خدمة الثيم الخاص غير متاحة حالياً');
    const store = await this.ownStore(userId, storeId);
    const open = await this.orders.count({ where: { storeId, jobs: { status: In(ACTIVE) } } });
    if (open) throw new BadRequestException('لديك طلب ثيم قيد التنفيذ لهذا المتجر');

    const slug = `custom-${(store.subdomain || 'store').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}-${randomBytes(3).toString('hex')}`;

    const { order, job } = await this.dataSource.transaction(async (m) => {
      if (cfg.price > 0) {
        await this.payment.handleWalletBalance(userId, cfg.price, 'SUB', TransactionType.CUSTOM_THEME, m);
      }
      const order = await m.save(m.create(CustomThemeOrder, {
        userId, storeId, slug, pricePaid: cfg.price, revisionsTotal: cfg.revisions, revisionsUsed: 0,
      }));
      const job = await m.save(m.create(CustomThemeJob, {
        orderId: order.id, kind: 'create', request: request.trim(), charged: cfg.price,
      }));
      return { order, job };
    });

    await this.submit(job, { kind: 'create', store: await this.brief(store), request: job.request }, order);
    return this.view(await this.reload(order.id));
  }

  /** طلب تعديل: يستهلك مراجعة (يجب شراء مراجعات إن نفدت) */
  async requestRevision(userId: string, orderId: string, request: string) {
    const order = await this.ownOrder(userId, orderId);
    if (!order.liveCode) throw new BadRequestException('الثيم لم يُنشر بعد — انتظر الإصدار الأول');
    if (order.jobs.some((j) => ACTIVE.includes(j.status))) throw new BadRequestException('يوجد تعديل قيد التنفيذ');
    if (order.revisionsUsed >= order.revisionsTotal) throw new BadRequestException('نفدت المراجعات — اشترِ مراجعات إضافية');

    const job = await this.dataSource.transaction(async (m) => {
      await m.increment(CustomThemeOrder, { id: order.id }, 'revisionsUsed', 1);
      return m.save(m.create(CustomThemeJob, { orderId: order.id, kind: 'revision', request: request.trim(), usedFreeRevision: true }));
    });
    const store = await this.stores.findOneOrFail({ where: { id: order.storeId }, relations: ['design', 'niche'] });
    await this.submit(job, { kind: 'revision', store: await this.brief(store), request: job.request, currentCode: order.liveCode }, order);
    return this.view(await this.reload(order.id));
  }

  async buyRevisions(userId: string, orderId: string, count: number) {
    const order = await this.ownOrder(userId, orderId);
    const { revisionPrice } = await this.config();
    const amount = Math.round(revisionPrice * count * 100) / 100;
    await this.dataSource.transaction(async (m) => {
      if (amount > 0) await this.payment.handleWalletBalance(userId, amount, 'SUB', TransactionType.CUSTOM_THEME_REVISIONS, m);
      await m.increment(CustomThemeOrder, { id: order.id }, 'revisionsTotal', count);
    });
    return this.view(await this.reload(order.id));
  }

  /* ─── الأدمن ─────────────────────────────────────────────────────────── */

  async adminList() {
    const pending = await this.jobs.find({ where: { status: In(ACTIVE) } });
    await this.syncJobs(pending);
    const rows = await this.orders.find({ relations: ['store', 'jobs'], order: { updatedAt: 'DESC' }, take: 100 });
    return rows.map((o) => ({ ...this.view(o), userId: o.userId }));
  }

  /** نشر فوري قبل انتهاء مدة الانتظار */
  async approve(jobId: string) {
    const job = await this.jobs.findOne({ where: { id: jobId }, relations: ['order'] });
    if (!job) throw new NotFoundException('الطلب غير موجود');
    if (job.status !== 'review') throw new BadRequestException('الطلب ليس في انتظار المراجعة');
    await this.goLive(job);
    return { id: job.id, status: 'live' };
  }

  /** رفض: لا يُنشر، ويُسترجع ما دُفع (أو المراجعة) */
  async reject(jobId: string, reason?: string) {
    const job = await this.jobs.findOne({ where: { id: jobId }, relations: ['order'] });
    if (!job) throw new NotFoundException('الطلب غير موجود');
    if (!ACTIVE.includes(job.status)) throw new BadRequestException('لا يمكن رفض هذا الطلب');
    await this.close(job, 'rejected', reason?.trim() || 'رفضه مدير المنصة');
    return { id: job.id, status: 'rejected' };
  }

  /** للـ cron اليومي: مزامنة كل الطلبات المفتوحة ونشر ما حان وقته */
  async syncAll() {
    const pending = await this.jobs.find({ where: { status: In(ACTIVE) } });
    await this.syncJobs(pending, true);
    return { checked: pending.length };
  }

  /* ─── الدورة: Claude ← بناء ← انتظار ← نشر ─────────────────────────── */

  private async submit(job: CustomThemeJob, input: GenerationInput, order: CustomThemeOrder) {
    try {
      const batchId = await this.generator.submit(job.id, input);
      await this.jobs.update(job.id, { batchId, attempts: job.attempts + 1, status: 'queued', lastCheckedAt: new Date() });
    } catch (err: any) {
      this.logger.error(`submit ${job.id}: ${err?.message}`);
      await this.close({ ...job, order } as CustomThemeJob, 'failed', 'تعذّر إرسال الطلب لـ Claude');
      throw new BadRequestException('تعذّر بدء صنع الثيم، استُرجع المبلغ — حاول لاحقاً');
    }
  }

  private async syncJobs(list: CustomThemeJob[], force = false) {
    for (const job of list) {
      try {
        if (job.status === 'queued') await this.syncQueued(job, force);
        else if (job.status === 'review' && job.liveAt && job.liveAt <= new Date()) {
          await this.goLive(await this.jobs.findOneOrFail({ where: { id: job.id }, relations: ['order'] }));
        }
      } catch (err: any) {
        this.logger.error(`sync ${job.id}: ${err?.message}`);
      }
    }
  }

  private async syncQueued(job: CustomThemeJob, force: boolean) {
    if (!job.batchId) return;
    if (!force && job.lastCheckedAt && Date.now() - job.lastCheckedAt.getTime() < CHECK_INTERVAL_MS) return;
    await this.jobs.update(job.id, { lastCheckedAt: new Date() });

    const outcome = await this.generator.check(job.batchId);
    if (outcome.state === 'pending') return;

    const full = await this.jobs.findOneOrFail({ where: { id: job.id }, relations: ['order'] });
    const store = await this.stores.findOneOrFail({ where: { id: full.order.storeId }, relations: ['design', 'niche'] });
    const brief = await this.brief(store);

    if (outcome.state === 'error') {
      if (outcome.retryable && full.attempts < MAX_ATTEMPTS) {
        const input: GenerationInput = full.kind === 'revision' && full.order.liveCode
          ? { kind: 'revision', store: brief, request: full.request, currentCode: full.order.liveCode }
          : { kind: 'create', store: brief, request: full.request };
        return this.submit(full, input, full.order);
      }
      return this.close(full, 'failed', outcome.message);
    }

    // بناء صارم — فشل البناء يعود لـ Claude مع الخطأ
    try {
      const { bundle } = await this.themeCode.build(full.order.slug, outcome.code, { strict: true });
      const delayHours = (await this.config()).delayHours;
      const now = new Date();
      await this.jobs.update(full.id, {
        status: 'review', code: outcome.code, bundle, error: null,
        readyAt: now, liveAt: new Date(now.getTime() + delayHours * 3_600_000),
      });
      if (delayHours === 0) await this.goLive(await this.jobs.findOneOrFail({ where: { id: full.id }, relations: ['order'] }));
    } catch (err: any) {
      const message = err?.response?.message ?? err?.message ?? 'build failed';
      if (full.attempts < MAX_ATTEMPTS) {
        await this.jobs.update(full.id, { error: String(message).slice(0, 4000) });
        return this.submit(full, { kind: 'fix', store: brief, request: full.request, brokenCode: outcome.code, error: String(message) }, full.order);
      }
      return this.close(full, 'failed', `فشل بناء الثيم: ${String(message).slice(0, 500)}`);
    }
  }

  /** نشر: رفع الملف، وعند الإنشاء: سجل الثيم (نوع custom) + ملكية التاجر + تطبيقه على متجره */
  private async goLive(job: CustomThemeJob) {
    if (!job.code || !job.bundle) throw new BadRequestException('لا يوجد كود جاهز');
    const order = job.order;
    await this.themeCode.upload(order.slug, job.code, job.bundle);

    let themeId = order.themeId;
    if (!themeId) {
      const store = await this.stores.findOneOrFail({ where: { id: order.storeId }, relations: ['hero'] });
      const type = await this.customType();
      const theme = await this.themes.save(this.themes.create({
        name_ar: `ثيم ${store.name} الخاص`, name_fr: `Thème personnalisé ${store.name}`, name_en: `${store.name} custom theme`,
        desc_ar: 'ثيم خاص صُمّم لهذا المتجر', desc_fr: 'Thème personnalisé pour cette boutique', desc_en: 'Custom theme designed for this store',
        slug: order.slug, price: 0, isActive: true, typeId: type.id, tag: ['custom'],
        imageUrl: (store as any).hero?.imageUrl || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800',
      } as any));
      themeId = (theme as any).id as string;
      await this.themeUsers.save(this.themeUsers.create({ userId: order.userId, themeId } as any));
      await this.stores.update(order.storeId, { themeId } as any);
    }

    await this.orders.update(order.id, { themeId, liveCode: job.code });
    await this.jobs.update(job.id, { status: 'live', bundle: null, liveAt: new Date() });
  }

  /** إنهاء بفشل/رفض: استرجاع المبلغ أو المراجعة */
  private async close(job: CustomThemeJob, status: 'failed' | 'rejected', error: string) {
    await this.dataSource.transaction(async (m) => {
      const charged = Number(job.charged || 0);
      if (charged > 0) await this.payment.handleWalletBalance(job.order.userId, charged, 'ADD', TransactionType.REFUND, m);
      if (job.usedFreeRevision) await m.decrement(CustomThemeOrder, { id: job.orderId }, 'revisionsUsed', 1);
      await m.update(CustomThemeJob, { id: job.id }, { status, error, bundle: null });
    });
  }

  /* ─── مساعدات ───────────────────────────────────────────────────────── */

  private async customType() {
    const found = await this.types.findOne({ where: { name: 'custom' } });
    return found ?? this.types.save(this.types.create({ name: 'custom' }));
  }

  private async ownStore(userId: string, storeId: string) {
    const store = await this.stores.findOne({ where: { id: storeId, user: { id: userId } }, relations: ['design', 'niche'] });
    if (!store) throw new NotFoundException('المتجر غير موجود');
    return store;
  }

  private async ownOrder(userId: string, orderId: string) {
    const order = await this.orders.findOne({ where: { id: orderId, userId }, relations: ['jobs', 'store'] });
    if (!order) throw new NotFoundException('الطلب غير موجود');
    return order;
  }

  private reload(orderId: string) {
    return this.orders.findOneOrFail({ where: { id: orderId }, relations: ['store', 'jobs'] });
  }

  private async brief(store: Store): Promise<StoreBrief> {
    const [cats, prods] = await Promise.all([
      this.dataSource.query(`SELECT name FROM categories WHERE "storeId" = $1 AND "deletedAt" IS NULL LIMIT 12`, [store.id]).catch(() => []),
      this.dataSource.query(`SELECT name FROM products WHERE "storeId" = $1 AND "deletedAt" IS NULL ORDER BY "createdAt" DESC LIMIT 12`, [store.id]).catch(() => []),
    ]);
    const s: any = store;
    return {
      name: store.name, language: store.language, currency: store.currency,
      primaryColor: s.design?.primaryColor ?? null, secondaryColor: s.design?.secondaryColor ?? null,
      niche: s.niche?.name_en ?? s.niche?.name_ar ?? null,
      categories: cats.map((c: any) => c.name), sampleProducts: prods.map((p: any) => p.name),
    };
  }

  private view(o: CustomThemeOrder) {
    const jobs = [...(o.jobs ?? [])].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return {
      id: o.id, storeId: o.storeId, storeName: o.store?.name, slug: o.slug, themeId: o.themeId,
      pricePaid: Number(o.pricePaid), revisionsTotal: o.revisionsTotal, revisionsUsed: o.revisionsUsed,
      revisionsLeft: Math.max(0, o.revisionsTotal - o.revisionsUsed), isLive: !!o.liveCode, createdAt: o.createdAt,
      jobs: jobs.map((j) => ({
        id: j.id, kind: j.kind, status: j.status, request: j.request, error: j.status === 'failed' || j.status === 'rejected' ? j.error : null,
        attempts: j.attempts, readyAt: j.readyAt, liveAt: j.liveAt, createdAt: j.createdAt,
      })),
    };
  }
}
