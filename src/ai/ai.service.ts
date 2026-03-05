import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import OpenAI from 'openai';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Product } from 'src/product/entities/product.entity';
import { Repository } from 'typeorm';

@Injectable()
export class AiService {
    private openai: OpenAI;

    constructor(
        private configService: ConfigService,
        @InjectRepository(Product)
        private readonly productRepo: Repository<Product>,
    ) {
        // إعداد الربط مع OpenRouter بدلاً من OpenAI مباشرة
        this.openai = new OpenAI({
            baseURL: 'https://openrouter.ai/api/v1',
            apiKey: this.configService.get<string>('OPENROUTER_API_KEY'),
            defaultHeaders: {
                'HTTP-Referer': 'http://localhost:3000', // ضروري لسياسة OpenRouter
                'X-Title': 'MDStore eCommerce',
            },
        });
    }

    // 🔥 المرحلة 1: توليد Prompt احترافي (Perplexity Style) باستخدام موديل مجاني
    async generatePromptProduct(productId: string): Promise<string> {
        const product = await this.productRepo.findOne({
            where: { id: productId },
            relations: ['category'],
        });

        if (!product) {
            throw new HttpException('Product not found', HttpStatus.NOT_FOUND);
        }

        // ✅ prompt احترافي جاهز بدون AI
        const prompt = `Luxury product photography of ${product.name}, 
    ${product.category?.name ?? 'premium product'}, 
    elegant studio setting, cinematic lighting, 
    bokeh background, 8k resolution, commercial advertisement style, 
    highly detailed, professional ecommerce hero image`;

        return prompt;
    }

    // 🚀 المرحلة 2: توليد الصورة (باستخدام Pollinations المجاني لعدم توفر توليد صور مجاني في OpenRouter)
    async generateProductImage(aiPrompt: string) {
        const cleanPrompt = aiPrompt.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

        try {
            // تحديث الرابط إلى المسار الجديد المطلوب
            const response = await fetch(
                'https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-xl-base-1.0',
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${this.configService.get('HUGGINGFACE_API_KEY')}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        inputs: cleanPrompt,
                        parameters: {
                            width: 768,   // العرض المناسب لـ 9:16 في SDXL
                            height: 1344, // الطول المناسب لـ 9:16
                            negative_prompt: "disfigured, deformed, blurry, cropped, low quality", // تحسين الجودة
                        },
                        options: { wait_for_model: true }
                    }),
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                console.error('🔴 HuggingFace Error:', response.status, errorText);
                throw new HttpException(`HF Router Error: ${errorText}`, HttpStatus.BAD_GATEWAY);
            }

            const buffer = await response.arrayBuffer();

            // تحويل الـ Buffer إلى Base64 للعرض في المتصفح
            const base64 = Buffer.from(buffer).toString('base64');
            const imageUrl = `data:image/jpeg;base64,${base64}`;

            return {
                success: true,
                imageUrl,
                promptUsed: cleanPrompt
            };

        } catch (error) {
            console.error('🔴 SDXL Service Crash:', error.message);
            throw new HttpException(error.message, error.status || HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}