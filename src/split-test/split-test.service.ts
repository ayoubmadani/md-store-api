import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { SplitTest, SplitVariant } from './entities/split-test.entity';
import { CreateSplitTestDto, SplitVariantDto, UpdateSplitTestDto } from './dto/split-test.dto';
import { Store } from '../store/entities/store.entity';
import { BuilderPage } from '../builder-pages/entities/builder-page.entity';
import { Domain } from '../domain/entities/domain.entity';
import { BuilderPagesService } from '../builder-pages/builder-pages.service';
import { DomainService } from '../domain/domain.service';

// حالات الطلب التي تُحتسب «مؤكدة» في الإحصائيات
const CONFIRMED_STATUSES = ['confirmed', 'shipping', 'delivered'];

@Injectable()
export class SplitTestService {
  constructor(
    @InjectRepository(SplitTest) private readonly testRepo: Repository<SplitTest>,
    @InjectRepository(Store) private readonly storeRepo: Repository<Store>,
    @InjectRepository(BuilderPage) private readonly pageRepo: Repository<BuilderPage>,
    @InjectRepository(Domain) private readonly domainRepo: Repository<Domain>,
    private readonly builderPages: BuilderPagesService,
    private readonly domains: DomainService,
    private readonly dataSource: DataSource,
  ) {}

  // ─── للتاجر ────────────────────────────────────────────────────────────────

  private async ownStore(storeId: string, userId: string) {
    const store = await this.storeRepo.findOne({ where: { id: storeId, user: { id: userId } }, select: ['id', 'subdomain'] });
    if (!store) throw new NotFoundException('المتجر غير موجود أو ليس لديك صلاحية');
    return store;
  }

  private async ownTest(id: string, userId: string) {
    const test = await this.testRepo.findOne({ where: { id, store: { user: { id: userId } } } });
    if (!test) throw new NotFoundException('الاختبار غير موجود');
    return test;
  }

  // صفحات منشورة من نفس المتجر وبلا تكرار؛ الأوزان الغائبة = توزيع متساوٍ
  private async validVariants(storeId: string, variants: SplitVariantDto[]): Promise<SplitVariant[]> {
    const ids = variants.map((v) => v.builderPageId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('لا تكرر نفس الصفحة في الاختبار');
    const pages = await this.pageRepo.find({ where: { id: In(ids), storeId }, select: ['id', 'publishedUrl', 'productId'] });
    if (pages.length !== ids.length) throw new BadRequestException('كل الصفحات يجب أن تكون من نفس المتجر');
    // اختبار عادل: كل الصفحات تبيع نفس المنتج، والفرق في التصميم والعرض فقط
    const products = new Set(pages.map((p) => p.productId || null));
    if (products.has(null)) throw new BadRequestException('كل صفحات الاختبار يجب أن تكون مربوطة بمنتج (إعدادات الصفحة ← منتج الصفحة)');
    if (products.size > 1) throw new BadRequestException('كل صفحات الاختبار يجب أن تبيع نفس المنتج');
    const unpublished = pages.filter((p) => !p.publishedUrl);
    if (unpublished.length) throw new BadRequestException('انشر كل الصفحات من المحرر قبل إضافتها للاختبار');
    // صفحة منتجها محذوف لا يمكن الطلب منها — تفسد الاختبار
    const broken: { name: string }[] = await this.dataSource.query(
      `SELECT b.name FROM builder_pages b LEFT JOIN products p ON p.id::text = b."productId"::text
       WHERE b.id = ANY($1::uuid[]) AND b."productId" IS NOT NULL AND (p.id IS NULL OR p."deletedAt" IS NOT NULL)`,
      [ids],
    );
    if (broken.length) {
      throw new BadRequestException(`منتج هذه الصفحات محذوف، اربطها بمنتج آخر من المحرر: ${broken.map((b) => b.name).join('، ')}`);
    }
    return variants.map((v) => ({ builderPageId: v.builderPageId, weight: v.weight ?? 1 }));
  }

  // كل اختبار على دومين خاص به: دومين جديد يُنشأ (ويُحتسب في حد دومينات الخطة)،
  // أو دومين صفحة هبوط موجود يتحول للاختبار — نفس رابط الإعلانات يبقى والصفحة تصبح إحدى المتنافسات
  async create(dto: CreateSplitTestDto, userId: string) {
    const store = await this.ownStore(dto.storeId, userId);
    const variants = await this.validVariants(store.id, dto.variants);

    if (dto.domainId) {
      const domain = await this.domainRepo.findOne({ where: { id: dto.domainId, storeId: store.id } });
      if (!domain) throw new NotFoundException('الدومين غير موجود في هذا المتجر');
      if (domain.scope !== 'landing_page') {
        throw new BadRequestException('هذا الدومين يعرض المتجر؛ اختر دومين صفحة هبوط أو أنشئ دوميناً جديداً للاختبار');
      }
      if (domain.splitTestId) throw new ConflictException('هذا الدومين مربوط باختبار آخر');
      const test = await this.testRepo.save(this.testRepo.create({ storeId: store.id, name: dto.name, domain: domain.domain, variants }));
      await this.domainRepo.update({ id: domain.id }, { builderPageId: null as any, splitTestId: test.id });
      return this.withPages(test);
    }

    if (!dto.domain) throw new BadRequestException('أدخل دوميناً للاختبار');
    const host = dto.domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
    if (await this.testRepo.exists({ where: { domain: host } })) throw new ConflictException('هذا الدومين مستعمل');

    const test = await this.testRepo.save(this.testRepo.create({ storeId: store.id, name: dto.name, domain: host, variants }));
    try {
      // نفس مسار إضافة الدومين في اللوحة: الصيغة، حد الخطة، التكرار، وربط Vercel للدومين الخاص
      await this.domains.create({ domain: host, storeId: store.id, scope: 'landing_page' } as any, { splitTestId: test.id });
    } catch (err) {
      await this.testRepo.delete({ id: test.id });
      throw err;
    }
    return this.withPages(test);
  }

  async list(storeId: string, userId: string) {
    await this.ownStore(storeId, userId);
    const tests = await this.testRepo.find({ where: { storeId }, order: { createdAt: 'DESC' } });
    return Promise.all(tests.map((t) => this.withPages(t)));
  }

  async update(id: string, dto: UpdateSplitTestDto, userId: string) {
    const test = await this.ownTest(id, userId);
    if (dto.name !== undefined) test.name = dto.name;
    if (dto.variants) test.variants = await this.validVariants(test.storeId, dto.variants);
    // الاستئناف: الصفحات قد تغيّرت أثناء الإيقاف (منتج آخر، منتج محذوف، غير منشورة) — نعيد الفحص
    if (dto.isActive === true && !dto.variants) await this.validVariants(test.storeId, test.variants);
    if (dto.isActive !== undefined) {
      test.isActive = dto.isActive;
      test.endedAt = dto.isActive ? null : test.endedAt ?? new Date();
      if (dto.isActive) test.winnerPageId = null;
    }
    return this.withPages(await this.testRepo.save(test));
  }

  // اعتماد الفائزة: كل الزوار إليها، والاختبار يتوقف (الإحصائيات تبقى للمراجعة)
  async setWinner(id: string, builderPageId: string, userId: string) {
    const test = await this.ownTest(id, userId);
    if (!test.variants.some((v) => v.builderPageId === builderPageId)) {
      throw new BadRequestException('الصفحة ليست ضمن هذا الاختبار');
    }
    test.winnerPageId = builderPageId;
    test.isActive = false;
    test.endedAt = new Date();
    return this.withPages(await this.testRepo.save(test));
  }

  async remove(id: string, userId: string) {
    const test = await this.ownTest(id, userId);
    // دومين مربوط بالاختبار يرجع للصفحة الفائزة (أو الأولى) حتى لا ينكسر الرابط
    const fallback = test.winnerPageId ?? test.variants[0]?.builderPageId ?? null;
    await this.domainRepo.update({ splitTestId: test.id }, { splitTestId: null, builderPageId: fallback as any });
    await this.testRepo.delete({ id: test.id });
    return { success: true };
  }

  async stats(id: string, userId: string) {
    const test = await this.ownTest(id, userId);
    const pageIds = test.variants.map((v) => v.builderPageId);
    const [views, orders] = await Promise.all([
      this.dataSource.query(
        `SELECT "builderPageId" AS id, count(*)::int AS n FROM shows
         WHERE "splitTestId" = $1 AND "builderPageId" = ANY($2::uuid[]) GROUP BY "builderPageId"`,
        [test.id, pageIds],
      ),
      this.dataSource.query(
        `SELECT "builderPageId" AS id, count(*)::int AS orders,
                count(*) FILTER (WHERE status::text = ANY($3::text[]))::int AS confirmed,
                coalesce(sum("totalPrice") FILTER (WHERE status::text = ANY($3::text[])), 0)::float AS revenue
         FROM orders
         WHERE "splitTestId" = $1 AND "storeId" = $4 AND "builderPageId" = ANY($2::uuid[])
         GROUP BY "builderPageId"`,
        [test.id, pageIds, CONFIRMED_STATUSES, test.storeId],
      ),
    ]);
    const names = await this.pageNames(pageIds);
    const totalWeight = test.variants.reduce((s, v) => s + v.weight, 0) || 1;
    const rows = test.variants.map((v) => {
      const viewCount = views.find((r: any) => r.id === v.builderPageId)?.n ?? 0;
      const o = orders.find((r: any) => r.id === v.builderPageId) ?? { orders: 0, confirmed: 0, revenue: 0 };
      return {
        builderPageId: v.builderPageId,
        name: names.get(v.builderPageId) ?? '—',
        sharePct: Math.round((v.weight / totalWeight) * 100),
        views: viewCount,
        orders: o.orders,
        confirmedOrders: o.confirmed,
        revenue: o.revenue,
        // نسبة التحويل = طلبات ÷ زيارات
        conversionPct: viewCount ? Math.round((o.orders / viewCount) * 1000) / 10 : 0,
        confirmedConversionPct: viewCount ? Math.round((o.confirmed / viewCount) * 1000) / 10 : 0,
        isWinner: test.winnerPageId === v.builderPageId,
      };
    });
    return { id: test.id, name: test.name, domain: test.domain, isActive: test.isActive, winnerPageId: test.winnerPageId, startedAt: test.createdAt, endedAt: test.endedAt, variants: rows };
  }

  private async pageNames(ids: string[]) {
    if (!ids.length) return new Map<string, string>();
    const pages = await this.pageRepo.find({ where: { id: In(ids) }, select: ['id', 'name'] });
    return new Map(pages.map((p) => [p.id, p.name]));
  }

  private async withPages(test: SplitTest) {
    const names = await this.pageNames(test.variants.map((v) => v.builderPageId));
    const domain = await this.domainRepo.findOne({ where: { splitTestId: test.id }, select: ['id', 'domain', 'isActive', 'isSub'] });
    return {
      ...test,
      url: `https://${test.domain}`,
      // دومين خاص ينتظر ضبط DNS حتى يتفعّل
      domainActive: domain?.isActive ?? false,
      domainId: domain?.id ?? null,
      variants: test.variants.map((v) => ({ ...v, name: names.get(v.builderPageId) ?? '—' })),
    };
  }

  // ─── عام (المتجر) ──────────────────────────────────────────────────────────

  // يختار الصفحة لزائر: الصفحة المحفوظة عنده إن كانت ما تزال ضمن الاختبار، وإلا قرعة حسب الأوزان.
  // اختبار متوقف أو له فائزة: الفائزة (أو أول صفحة) ولا يُرجع splitTestId حتى لا تُحتسب الزيارات.
  async resolve(id: string, preferredPageId?: string, previewIndex?: number) {
    const test = await this.testRepo.findOne({ where: { id } });
    if (!test || !test.variants.length) throw new NotFoundException('الصفحة غير موجودة');

    // معاينة التاجر (?ab=2): الصفحة رقم n كما هي، بلا تسجيل زيارة ولا تغيير اختيار الزائر
    const previewed = previewIndex ? test.variants[previewIndex - 1] : undefined;
    if (previewed) {
      const page = await this.builderPages.findPublicById(previewed.builderPageId);
      return { ...page, splitTestId: null, preview: true };
    }

    const running = test.isActive && !test.winnerPageId;
    let pageId: string;
    if (!running) {
      pageId = test.winnerPageId ?? test.variants[0].builderPageId;
    } else if (preferredPageId && test.variants.some((v) => v.builderPageId === preferredPageId)) {
      pageId = preferredPageId;
    } else {
      pageId = pickBalanced(test.variants, test.assignedCounts ?? {});
      // عدّاد ذرّي: كل زائر جديد يُحتسب للصفحة التي أُعطيت له
      await this.dataSource.query(
        `UPDATE split_tests
         SET "assignedCounts" = jsonb_set("assignedCounts", ARRAY[$2::text], to_jsonb(coalesce(("assignedCounts"->>$2)::int, 0) + 1))
         WHERE id = $1`,
        [test.id, pageId],
      );
    }

    const page = await this.builderPages.findPublicById(pageId);
    return { ...page, splitTestId: running ? test.id : null };
  }
}

// توزيع متوازن: الزائر الجديد يذهب للصفحة الأبعد عن نصيبها (عدد ÷ وزن هو الأصغر).
// 50/50 ← A, B, A, B…؛ 50/25/25 ← نفس النسب بالضبط. التعادل: بالترتيب.
function pickBalanced(variants: SplitVariant[], counts: Record<string, number>) {
  let best = variants[0];
  let bestScore = Infinity;
  for (const v of variants) {
    const score = (counts[v.builderPageId] ?? 0) / Math.max(1, v.weight);
    if (score < bestScore) { best = v; bestScore = score; }
  }
  return best.builderPageId;
}
