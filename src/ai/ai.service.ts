import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { fal } from '@fal-ai/client';
import { Product } from '../product/entities/product.entity';

@Injectable()
export class AiService {

    constructor(
        private configService: ConfigService,
        @InjectRepository(Product)
        private readonly productRepo: Repository<Product>,
    ) {
        fal.config({
            credentials: this.configService.get<string>('FAL_KEY') as string,
        });
    }

    // ─────────────────────────────────────────────────────────────────
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
            : ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=1000'];

        return {
            images: productImages,
            prompt: basePrompt,
            product: { name: product.name, price: product.price },
        };
    }

    // ─────────────────────────────────────────────────────────────────
    async generateProductImage(data: {
        images: string[];
        prompt: string;
        productName: string;
        price: string;
    }) {
        try {
            if (!data.images?.[0]) throw new Error('الصورة مفقودة');

            let imageUrl = data.images[0];

            // ── إذا صورة محلية: ارفعها على fal storage ───────────────
            if (imageUrl.includes('localhost') || imageUrl.includes('127.0.0.1')) {
                const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
                const imageBuffer = Buffer.from(imageResponse.data, 'binary');
                const imageBlob = new Blob([imageBuffer], { type: 'image/jpeg' });
                imageUrl = await fal.storage.upload(imageBlob as any);
            }

            // ── Image-to-Image عبر FLUX.1 [dev] ──────────────────────
            const result = await fal.subscribe('fal-ai/flux/dev/image-to-image', {
                input: {
                    image_url: imageUrl,
                    prompt: data.prompt,
                    strength: 0.80,
                    num_inference_steps: 35,
                    guidance_scale: 7.5,
                },
            }) as any;

            // ── جلب الصورة الناتجة ────────────────────────────────────
            const aiImageResponse = await axios.get(result.data.images[0].url, {
                responseType: 'arraybuffer',
            });
            const aiImageBuffer = Buffer.from(aiImageResponse.data);

            return {
                success: true,
                imageUrl: `data:image/png;base64,${aiImageBuffer.toString('base64')}`,
            };

        } catch (error) {
            console.error('🔴 AI Error:', error.message);
            throw new HttpException(
                `خطأ: ${error.message}`,
                error.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}

// ─────────────────────────────────────────────────────────────────────
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