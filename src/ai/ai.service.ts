import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import Replicate from 'replicate';
import { Product } from '../product/entities/product.entity';

@Injectable()
export class AiService {
  private replicate: Replicate;

  constructor(
    private configService: ConfigService,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {
    this.replicate = new Replicate({
      auth: this.configService.get<string>('REPLICATE_API_KEY'),
    });
  }

  // 1. جلب بيانات المنتج (اسم، وصف، سعر)
  async generatePromptProduct(productId: string): Promise<{
    images: string[];
    prompt: string;
    product: { name: string; price: number };
  }> {
    const product = await this.productRepo.findOne({
      where: { id: productId },
      relations: ['category', 'imagesProduct'],
    });

    if (!product) {
      throw new HttpException('المنتج غير موجود', HttpStatus.NOT_FOUND);
    }

    const basePrompt = initPrompt({
      name: product.name,
      desc: product.desc,
      price: product.price,
    });

    const productImages = product.imagesProduct.length > 0
      ? product.imagesProduct.map(item => item.imageUrl)
      : [];

    return {
      images: productImages,
      prompt: basePrompt,
      product: { name: product.name, price: product.price },
    };
  }

  // 2. التوليد باستخدام Nano Banana Pro
  async generateProductImage(data: {
    images: string[];
    prompt: string;
  }) {
    try {
      if (!data.images?.[0]) throw new Error('الصورة الأصلية مفقودة');

      // نستخدم الموديل الأكثر استقراراً وقوة حالياً (Flux Pro / Nano Banana Pro)
      const output: any = await this.replicate.run(
        "lucataco/nano-banana-pro:8601633d", // تأكد من الـ Version ID من Replicate
        {
          input: {
            prompt: prompt,

            image: data.images[0], // لإعطاء الموديل شكل المنتج الحقيقي
            prompt_strength: 0.8,  // توازن مثالي للحفاظ على المنتج وتغيير المحيط
            aspect_ratio: "9:16",
            output_format: "webp",
            output_quality: 75,
            guidance_scale: 3.5,    // لضمان الالتزام بالوصف
          },
        },
      );

      const generatedUrl = Array.isArray(output) ? output[0] : output;
      if (!generatedUrl) throw new Error('AI لم يقم بتوليد الرابط');

      // جلب الصورة (رفعنا الـ timeout لـ 60 ثانية لأن الموديل ثقيل)
      const response = await axios.get(generatedUrl, {
        responseType: 'arraybuffer',
        timeout: 60000
      });

      return {
        success: true,
        imageUrl: `data:image/webp;base64,${Buffer.from(response.data).toString('base64')}`,
      };

    } catch (error) {
      console.error('❌ Nano Banana Pro Error:', error.message);
      throw new HttpException(`فشل التوليد: ${error.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}

function initPrompt({ name, desc, price }: { name: string; desc?: string; price: number }) {
  return `
    Create a vertical mobile product landing page banner,  [Arabic RTL layout.]

PRODUCT: ${name}
DESCRIPTION : ${desc}

──────────────────────────────
COLOR PALETTE:
(extracted from product image + product type)
──────────────────────────────
Background:        [BG_COLOR]
Accent:            [ACCENT_COLOR]
CTA buttons:       [CTA_COLOR]
Bottom gradient:   [GRADIENT_START] → [GRADIENT_END]
Headlines:         [HEADLINE_COLOR]
Body text:         [TEXT_COLOR]
Bubbles/decor:     [BUBBLE_COLOR] at 30% opacity
Badge bg:          [BADGE_COLOR]
Price tag bg:      [PRICE_BG_COLOR]
Button text:       [CTA_TEXT_COLOR]

──────────────────────────────
SECTION 1 — HERO (top 33%):
──────────────────────────────
Background: [BG_COLOR].
Top-right: rounded pill badge, [BADGE_COLOR] fill, white bold Arabic text "[BADGE_TEXT]".
Below badge: large bold Arabic headline right-aligned "[HEADLINE]", color [HEADLINE_COLOR].
One subtitle line in light weight Arabic, [TEXT_COLOR].
Center: product image, clean white background, soft drop shadow.
Scattered 6–8 semi-transparent [BUBBLE_COLOR] circles, varying sizes 20px–80px.

──────────────────────────────
SECTION 2 — BENEFITS (middle 34%):
──────────────────────────────
Background: [BG_COLOR].
Large bold Arabic heading centered: "[BENEFIT_HEADLINE]", [HEADLINE_COLOR].
Short thick underline in [ACCENT_COLOR] directly beneath heading.
2–3 lines of Arabic body text, [TEXT_COLOR], centered.
2 bullet rows right-aligned: [ACCENT_COLOR] filled checkmark icon + Arabic benefit text.
Product image: angled side view, small label tag showing "[DEGREE]°" in [ACCENT_COLOR].
Same floating [BUBBLE_COLOR] bubble decorations.

──────────────────────────────
SECTION 3 — CTA (bottom 33%):
──────────────────────────────
Background: soft gradient [GRADIENT_START] top → [GRADIENT_END] bottom.
Small Arabic urgency text above price, [TEXT_COLOR].
Price block: rounded rectangle [PRICE_BG_COLOR], bold white text "${price} DZD", large font.
Below price: pill outline button, [ACCENT_COLOR] border, "[SHIPPING_TEXT]" Arabic text.
Bottom-left: partial product image.
Full-width bottom bar: delivery truck icon left + rounded [CTA_COLOR] button right, white bold Arabic "[CTA_TEXT]".

──────────────────────────────
GLOBAL RULES:
──────────────────────────────
- All text Arabic only, right-to-left, zero Latin characters
- Headlines: geometric bold sans-serif, large scale
- Body: clean regular weight, comfortable line-height
- Product photography: sharp, professional lighting, no background clutter
- Sections divided by subtle spacing, no hard borders
- Output: max with md , portrait, high resolution, e-commerce product style
    `;
}