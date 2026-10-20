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

describe('colors', () => {
  const input = { productName: 'x', description: '', price: 1, language: 'ar' as const, style: 'أطفال', cutouts: 1, details: 0, shipsAllWilayas: false };

  it('sends product and original-background colors separately', () => {
    const m = buildImagePageUserMessage({ ...input, palette: ['#e8410c'], backgroundPalette: ['#f2e6d8'] }, { heroLayout: 'H', decor: 'D' });
    expect(m).toContain('ألوان المنتج: #e8410c');
    expect(m).toContain('ألوان خلفية الصورة الأصلية: #f2e6d8');
  });

  it('works without background colors', () => {
    const m = buildImagePageUserMessage({ ...input, palette: ['#e8410c'] }, { heroLayout: 'H', decor: 'D' });
    expect(m).toContain('ألوان خلفية الصورة الأصلية: غير متوفرة');
  });

  it('merchant primary color: sent as the main color, secondary is derived', () => {
    const m = buildImagePageUserMessage({ ...input, palette: ['#e8410c'], primaryColor: '#0a7d4f' }, { heroLayout: 'H', decor: 'D' });
    expect(m).toContain('اللون الأساسي الذي اختاره التاجر: #0a7d4f');
    expect(buildImagePageSystemPrompt('ar')).toContain('استنتج لوناً ثانوياً');
  });

  it('no primary color line when the merchant did not pick one', () => {
    const m = buildImagePageUserMessage({ ...input, palette: ['#e8410c'] }, { heroLayout: 'H', decor: 'D' });
    expect(m).not.toContain('اللون الأساسي الذي اختاره التاجر');
  });

  it('lets the model choose colors that make the product stand out', () => {
    const p = buildImagePageSystemPrompt('ar');
    expect(p).toContain('حسب نوع المنتج');
    expect(p).toContain('لا تجعل لون المنتج الرئيسي خلفية');
    expect(p).not.toContain('ابنِ كل الألوان من القائمة المعطاة');
  });
});

describe('pickVariation', () => {
  it('is deterministic with a stubbed rand', () => {
    expect(pickVariation(() => 0)).toEqual(pickVariation(() => 0));
    expect(pickVariation(() => 0)).not.toEqual(pickVariation(() => 0.99));
  });
});

describe('IMAGE_PAGE_SCHEMA', () => {
  it('form keys are the productForm block keys plus borderRadius', () => {
    const props = (IMAGE_PAGE_SCHEMA as any).properties.form.properties;
    expect(Object.keys(props).sort()).toEqual([...BLOCK_FIELD_KEYS.productForm, 'borderRadius', 'labelPosition', 'fieldVariant'].sort());
    expect(props.borderRadius.type).toBe('integer');
    expect(props.labelPosition.enum).toEqual(['inside', 'above']);
    expect(props.fieldVariant.enum).toEqual(['outlined', 'filled', 'underline']);
  });
  it('asks for a corner radius and form style that match the design', () => {
    const p = buildImagePageSystemPrompt('ar');
    for (const k of ['borderRadius', 'labelPosition', 'fieldVariant']) expect(p).toContain(k);
  });
});
