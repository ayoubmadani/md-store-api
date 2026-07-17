// Shared between AnthropicService and GeminiService — both generate the
// same block-tree shape consumed by dashboard/src/pages/editor/blocks/componentsMap.js.
// Intentionally limited to exactly the two blocks AI generation ever
// produces (see BLOCK_SYSTEM_PROMPT): the landing page's hero image, then
// the order form. Everything else on the page is added manually in the
// editor, by design — componentsMap.js has no renderer for anything else
// this used to generate (hero/text/button/productGrid/imageText), so
// keeping this list in sync with it isn't optional.
export type BuilderBlockType = 'image' | 'productForm';

export interface BuilderBlock {
  type: BuilderBlockType;
  props: Record<string, string | number>;
}

// image has no text-generatable fields — the model cannot produce a real
// image URL, that's filled in a separate pass by ReplicateImageService (see
// builder-pages.service.ts). productForm's fields are the order form's own
// copy and colors, chosen to suit the product.
export const BLOCK_FIELD_KEYS: Record<BuilderBlockType, string[]> = {
  image: [],
  productForm: [
    'title',
    'buttonText',
    'backgroundColor',
    'textColor',
    'buttonBackgroundColor',
    'buttonTextColor',
    'inputBackgroundColor',
    'inputBorderColor',
    'inputTextColor',
    'containerBackgroundColor',
  ],
};

export const BLOCK_SYSTEM_PROMPT = `أنت مصمم صفحات هبوط محترف متخصص في متاجر التجارة الإلكترونية العربية.
مهمتك: إنشاء صفحة هبوط لمنتج واحد، بصيغة JSON فقط، مطابقة تماماً للمخطط المحدد.

قواعد:
- الصفحة تتكوّن دائماً من قسمين اثنين فقط، بهذا الترتيب بالضبط: image أولاً (الصورة الرئيسية للصفحة)، ثم productForm (نموذج الطلب).
- لا تنشئ أي قسم آخر أبداً — أي إضافات أخرى (نصوص، صور إضافية، أزرار...) تتم يدوياً من طرف المستخدم في المحرر لاحقاً.
- قسم image لا يحتاج أي محتوى نصي منك — سيتم إنشاء الصورة تلقائياً بناءً على وصف المنتج في خطوة منفصلة.
- قسم productForm يحتاج:
  - title: عنوان تحفيزي قصير أعلى نموذج الطلب.
  - buttonText: نص زر الطلب، مقنع ومباشر يحث على الشراء الآن.
  - ألوان بصيغة hex متناسقة تناسب طبيعة المنتج: backgroundColor وtextColor (خلفية ونص النموذج نفسه)، buttonBackgroundColor وbuttonTextColor (الزر)، inputBackgroundColor وinputBorderColor وinputTextColor (حقول الإدخال)، وcontainerBackgroundColor (خلفية الحاوية المحيطة بالنموذج بالكامل).
- لا تضف أي نص خارج JSON، ولا تشرح ما فعلته.`;

export function languageNote(language: 'ar' | 'fr' | 'en' = 'ar'): string {
  return language === 'ar'
    ? 'اكتب كل النصوص باللغة العربية.'
    : language === 'fr'
      ? 'Write all copy in French.'
      : 'Write all copy in English.';
}

// Reduces a flat { type, ...allPossibleFields } object (used by schemas that
// can't express a discriminated union, e.g. Gemini's) down to only the props
// that actually belong to that block's type.
export function pickBlockProps(type: BuilderBlockType, raw: Record<string, any>): BuilderBlock {
  const keys = BLOCK_FIELD_KEYS[type] || [];
  const props: Record<string, string | number> = {};
  for (const key of keys) {
    if (raw[key] !== undefined && raw[key] !== null) props[key] = raw[key];
  }
  return { type, props };
}

// The exact "one image, one productForm, image first" shape is asked for in
// the system prompt, but nothing in the JSON schema enforces it (the
// structured-output API doesn't support an exact array length constraint —
// see PAGE_TREE_SCHEMA in anthropic.service.ts) — so this is the actual
// guarantee: drop anything past the first block of each type, then order
// image before productForm regardless of what order the model returned.
const BLOCK_ORDER: Record<BuilderBlockType, number> = { image: 0, productForm: 1 };
export function sanitizeGeneratedBlocks(blocks: BuilderBlock[]): BuilderBlock[] {
  const seen = new Set<BuilderBlockType>();
  const deduped = blocks.filter((block) => {
    if (!(block.type in BLOCK_ORDER) || seen.has(block.type)) return false;
    seen.add(block.type);
    return true;
  });
  return deduped.sort((a, b) => BLOCK_ORDER[a.type] - BLOCK_ORDER[b.type]);
}
