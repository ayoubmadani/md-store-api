import {
  buildImagePageSystemPrompt,
  buildImagePageUserMessage,
  pickVariation,
  validateImagePageHtml,
  IMAGE_PAGE_SCHEMA,
} from './image-page-prompt';
import { BLOCK_FIELD_KEYS } from '../../ai/block-schema';

const section = (body = '<h1>عنوان</h1>') => `<section class="s" id="x">${body}</section>`;
const page = (n: number, extra = '') =>
  `<!doctype html><html dir="rtl" lang="ar"><head><style>:root{--a:#000}</style></head><body>${Array.from({ length: n }, () => section()).join('')}${extra}</body></html>`;

describe('validateImagePageHtml', () => {
  it('accepts 3..6 sections', () => {
    expect(validateImagePageHtml(page(3), 2, 2)).toEqual({ ok: true });
    expect(validateImagePageHtml(page(6), 2, 2)).toEqual({ ok: true });
  });
  it('rejects 2 sections', () => {
    expect(validateImagePageHtml(page(2), 2, 2).ok).toBe(false);
  });
  it('rejects 7 sections', () => {
    expect(validateImagePageHtml(page(7), 2, 2).ok).toBe(false);
  });
  it('rejects script', () => {
    expect(validateImagePageHtml(page(3, '<script>alert(1)</script>'), 2, 2).ok).toBe(false);
  });
  it('rejects onclick=', () => {
    expect(validateImagePageHtml(page(3, '<div onclick="x()">a</div>'), 2, 2).ok).toBe(false);
  });
  it('rejects external url in src', () => {
    expect(validateImagePageHtml(page(3, '<img src="https://evil.com/a.png">'), 2, 2).ok).toBe(false);
  });
  it('rejects external url in css url()', () => {
    expect(validateImagePageHtml(page(3, '<div style="background:url(http://x.com/a.png)"></div>'), 2, 2).ok).toBe(false);
  });
  it('rejects position:fixed', () => {
    expect(validateImagePageHtml(page(3, '<div style="position: fixed">a</div>'), 2, 2).ok).toBe(false);
  });
  it('rejects unknown placeholder {{IMG_4}} when cutouts=3', () => {
    expect(validateImagePageHtml(page(3, '<img src="{{IMG_4}}">'), 3, 0).ok).toBe(false);
  });
  it('accepts known placeholders', () => {
    expect(validateImagePageHtml(page(3, '<img src="{{IMG_1}}"><img src="{{DETAIL_2}}">'), 1, 2)).toEqual({ ok: true });
  });
});

describe('buildImagePageSystemPrompt', () => {
  it('contains dir="rtl" for ar and dir="ltr" for fr', () => {
    expect(buildImagePageSystemPrompt('ar')).toContain('dir="rtl"');
    expect(buildImagePageSystemPrompt('fr')).toContain('dir="ltr"');
    expect(buildImagePageSystemPrompt('en')).toContain('dir="ltr"');
  });
  it('never mentions testimonials', () => {
    for (const l of ['ar', 'fr', 'en'] as const) {
      expect(buildImagePageSystemPrompt(l)).not.toMatch(/آراء الزبائن|قبل وبعد/);
    }
  });
  it('names the fonts and the num rule', () => {
    const p = buildImagePageSystemPrompt('ar');
    expect(p).toContain('Lalezar');
    expect(p).toContain('Tajawal');
    expect(p).toContain('class="num"');
  });
});

describe('buildImagePageUserMessage', () => {
  it('includes product facts, placeholders and variation', () => {
    const m = buildImagePageUserMessage(
      { productName: 'فستان', description: 'قطني', price: 3500, oldPrice: 4500, variants: 'S, M', category: 'ملابس', language: 'ar', style: 'فاخر', palette: ['#112233'], cutouts: 2, details: 1, shipsAllWilayas: true },
      { heroLayout: 'H1', decor: 'D1' },
    );
    for (const s of ['فستان', '3500', '4500', 'S, M', '#112233', '{{IMG_1}}', '{{IMG_2}}', '{{DETAIL_1}}', 'H1', 'D1', 'فاخر']) expect(m).toContain(s);
    expect(m).not.toContain('{{IMG_3}}');
  });
});

describe('pickVariation', () => {
  it('is deterministic with a stubbed rand', () => {
    expect(pickVariation(() => 0)).toEqual(pickVariation(() => 0));
    expect(pickVariation(() => 0)).not.toEqual(pickVariation(() => 0.99));
  });
});

describe('IMAGE_PAGE_SCHEMA', () => {
  it('form keys are exactly the productForm block keys', () => {
    expect(Object.keys((IMAGE_PAGE_SCHEMA as any).properties.form.properties).sort()).toEqual([...BLOCK_FIELD_KEYS.productForm].sort());
  });
  it('asks for compact output to keep cost low', () => {
    const p = buildImagePageSystemPrompt('ar');
    expect(p).toContain('بدون تعليقات');
    expect(p).toContain('بدون مسافات بادئة');
  });
});
