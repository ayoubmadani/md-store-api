// صفحات هبوط مصوّرة: برومبت Claude، اختيار التنويع، وفحص الـ HTML الناتج قبل احتسابه.
// كل <section class="s"> يتحول في متصفح التاجر إلى صورة مستقلة، لذلك الفحص صارم.
import { BLOCK_FIELD_KEYS } from '../../ai/block-schema';

export type ImagePageLanguage = 'ar' | 'fr' | 'en';

export type ImagePageInput = {
  productName: string;
  description: string;
  price: number;
  oldPrice?: number | null;
  variants?: string;
  category?: string;
  language: ImagePageLanguage;
  style: string;
  palette: string[];
  cutouts: number;
  details: number;
  shipsAllWilayas: boolean;
};

const LANG: Record<ImagePageLanguage, { name: string; dir: 'rtl' | 'ltr' }> = {
  ar: { name: 'العربية الفصحى البسيطة', dir: 'rtl' },
  fr: { name: 'الفرنسية', dir: 'ltr' },
  en: { name: 'الإنجليزية', dir: 'ltr' },
};

// برومبت صاحب المنصة، بنسخة لكل لغة — بدون آراء زبائن ولا مقارنات
export function buildImagePageSystemPrompt(language: ImagePageLanguage): string {
  const { name, dir } = LANG[language];
  return `أنت مصمم صفحات هبوط محترف لمتاجر الدفع عند الاستلام في الجزائر.
مهمتك: كتابة قالب HTML واحد يحتوي على أقسام صفحة هبوط، كل قسم سيُحوَّل إلى صورة مستقلة، مع ألوان نموذج الطلب الذي يأتي بعد الصور.

## الأقسام المطلوبة بالترتيب
1. القسم الرئيسي: عنوان قوي، صورة المنتج، السعر.
2. الفوائد: من 3 إلى 4 فوائد مع أيقونات SVG بسيطة.
3. التفاصيل: صور التفاصيل المقربة مع شرح قصير لكل واحدة (فقط إذا وُجدت صور تفاصيل).
4. المقاسات أو الخيارات: فقط إذا كانت موجودة في المعلومات.
5. الثقة: الدفع عند الاستلام، التوصيل، المعاينة قبل الدفع، ثم دعوة لملء الاستمارة أسفل الصور.
لا تضف أي قسم آخر: لا آراء أو شهادات، ولا مقارنات نتائج.

## قواعد المقاسات (إلزامية)
- كل قسم عنصر <section class="s" id="..."> بعرض 720 بكسل ثابت.
- ارتفاع كل قسم بين 600 و1100 بكسل.
- الهوامش الجانبية 32 بكسل على الأقل.
- أصغر حجم خط 26 بكسل، والعناوين 48 بكسل فما فوق.
- لا يخرج أي نص أو صورة عن حدود القسم (overflow: hidden على كل قسم).
- من 3 إلى 6 أقسام فقط.

## قواعد الخطوط
الخطوط المتاحة فقط (محمّلة مسبقاً، لا تستوردها):
- font-family: 'Lalezar' للعناوين.
- font-family: 'Tajawal' بالوزن 500 للنص و800 للنص العريض.
- كل رقم يوضع داخل <span class="num"> مع font-family: 'Tajawal'، لأن خط العناوين لا يحتوي على أرقام.

## قواعد اللغة والاتجاه
- الصفحة <html dir="${dir}" lang="${language}">.
- كل النص باللغة ${name}، جمل قصيرة، بدون كلمات من لغة أخرى.
- العنوان الرئيسي لا يتجاوز 6 كلمات.
- كل فقرة لا تتجاوز 12 كلمة.

## قواعد المحتوى
- لا تخترع معلومات غير موجودة في وصف التاجر أو ظاهرة في الصور: لا نوع قماش، لا مكونات، لا أرقام مبيعات، لا آراء زبائن.
- لا وعود طبية أو نتائج مضمونة.
- اكتب "التوصيل لكل الولايات" فقط إذا قيل لك ذلك في المعلومات.

## الصور
- استعمل فقط الخانات المعطاة في المعلومات كقيمة src، حرفياً (مثل {{IMG_1}})، ولا أي رابط آخر.
- صور IMG بخلفية شفافة: ضعها فوق خلفية ملوّنة أو شكل زخرفي.
- صور DETAIL صور أصلية للتفاصيل: اعرضها بإطار أو زوايا مستديرة مع object-fit: cover.

## الألوان
ابنِ كل الألوان من القائمة المعطاة، ويمكنك إضافة لون فاتح ولون داكن للنص فقط. استعمل متغيرات CSS داخل :root.

## قواعد تقنية
- ملف HTML واحد، الأنماط داخل <style>، بدون JavaScript، بدون on* events.
- بدون روابط خارجية إطلاقاً (لا http ولا https ولا @import).
- لا تستعمل position: fixed.
- الأيقونات SVG مكتوبة داخل الصفحة.

## الإيجاز (إلزامي)
- اكتب HTML وCSS مضغوطين: بدون تعليقات، بدون مسافات بادئة، بدون أسطر فارغة.
- أصناف CSS قصيرة ومشتركة تُعاد في كل الأقسام، ولا تكرر نفس الأنماط داخل style لكل عنصر.
- كل أيقونة SVG بسيطة: viewBox صغير وpath واحد أو اثنان.
- لا تكتب أي نص أو عنصر لا يظهر في الصورة النهائية.

## نموذج الطلب
النموذج حقيقي ويأتي بعد الصور. أرجع ألوانه في form بنفس ألوان الصفحة (قيم hex)، وtitle قصير وbuttonText قصير بنفس اللغة.
formAfter = ترتيب القسم (من 0) الذي يوضع النموذج بعده، عادة آخر قسم.

## شكل الإخراج
JSON فقط مطابق للمخطط: { html, form, formAfter }. html يبدأ بـ <!doctype html>.`;
}

export function buildImagePageUserMessage(input: ImagePageInput, variation: { heroLayout: string; decor: string }): string {
  const cut = Array.from({ length: input.cutouts }, (_, i) => `{{IMG_${i + 1}}}`).join('، ') || 'لا يوجد';
  const det = Array.from({ length: input.details }, (_, i) => `{{DETAIL_${i + 1}}}`).join('، ') || 'لا يوجد';
  return `## معلومات المنتج
- اسم المنتج: ${input.productName}
- وصف التاجر: ${input.description || '—'}
- السعر: ${input.price}
- السعر القديم: ${input.oldPrice ?? ''}
- المقاسات أو الخيارات: ${input.variants || 'لا يوجد'}
- الفئة: ${input.category || '—'}
- التوصيل لكل الولايات: ${input.shipsAllWilayas ? 'نعم' : 'لا'}

## الصور المتاحة
- صور المنتج بدون خلفية: ${cut}
- صور تفاصيل: ${det}

## الألوان المستخرجة من صورة المنتج
${input.palette.join('، ')}

## الطابع والتخطيط المطلوب
- الطابع العام: ${input.style}
- تخطيط القسم الرئيسي: ${variation.heroLayout}
- شكل الزخارف: ${variation.decor}
التزم بهذه الاختيارات تماماً، حتى لا تتشابه الصفحات بين التجار.`;
}

const HERO_LAYOUTS = [
  'صورة المنتج كبيرة في الوسط والعنوان فوقها والسعر في شارة أسفلها',
  'العنوان في النصف العلوي والمنتج مائل في النصف السفلي فوق دائرة ملوّنة',
  'المنتج على جانب والعنوان والسعر على الجانب الآخر بخلفية مقسومة بزاوية',
  'خلفية بلون واحد قوي والمنتج في الأسفل يخرج من إطار منحني والعنوان في الأعلى',
  'بطاقة بيضاء كبيرة في الوسط فيها المنتج والعنوان على خلفية متدرجة',
  'شريط عرض مائل يحمل السعر والمنتج كبير خلفه مع ظل ناعم',
];
const DECORS = [
  'دوائر متداخلة شفافة',
  'خطوط منحنية وموجات',
  'أشكال هندسية حادة ومثلثات',
  'نقاط وشبكة خفيفة',
  'إطارات مزدوجة وزوايا مزخرفة',
  'شرائط مائلة',
];

export function pickVariation(rand: () => number = Math.random): { heroLayout: string; decor: string } {
  const at = (list: string[]) => list[Math.min(list.length - 1, Math.floor(rand() * list.length))];
  return { heroLayout: at(HERO_LAYOUTS), decor: at(DECORS) };
}

export const IMAGE_PAGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['html', 'form', 'formAfter'],
  properties: {
    html: { type: 'string' },
    form: {
      type: 'object',
      additionalProperties: false,
      required: [...BLOCK_FIELD_KEYS.productForm],
      properties: Object.fromEntries(BLOCK_FIELD_KEYS.productForm.map((k) => [k, { type: 'string' }])),
    },
    formAfter: { type: 'integer' },
  },
} as const;

export function validateImagePageHtml(html: string, cutouts: number, details: number): { ok: true } | { ok: false; reason: string } {
  const sections = (html.match(/<section\b[^>]*class\s*=\s*["'][^"']*\bs\b[^"']*["']/gi) || []).length;
  if (sections < 3 || sections > 6) return { ok: false, reason: `عدد الأقسام ${sections} — المطلوب من 3 إلى 6 أقسام <section class="s">` };
  if (/<script\b/i.test(html)) return { ok: false, reason: 'ممنوع <script>' };
  if (/\son[a-z]+\s*=/i.test(html)) return { ok: false, reason: 'ممنوع on* events' };
  if (/(https?:)?\/\/[a-z0-9.-]+\.[a-z]{2,}/i.test(html.replace(/xmlns(:\w+)?="[^"]*"/g, ''))) return { ok: false, reason: 'ممنوع أي رابط خارجي — استعمل الخانات فقط' };
  if (/@import\b/i.test(html)) return { ok: false, reason: 'ممنوع @import' };
  if (/position\s*:\s*fixed/i.test(html)) return { ok: false, reason: 'ممنوع position: fixed' };
  for (const m of html.matchAll(/\{\{(IMG|DETAIL)_(\d+)\}\}/g)) {
    const max = m[1] === 'IMG' ? cutouts : details;
    if (+m[2] < 1 || +m[2] > max) return { ok: false, reason: `خانة غير موجودة ${m[0]}` };
  }
  return { ok: true };
}
