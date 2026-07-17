import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Replicate from 'replicate';
import axios from 'axios';

// AI's job here is strictly "photography, not design": clean, text-free
// product/lifestyle photos that get dropped into the page's image block
// `src` slot. Actual layout, typography, and branding stay with the block
// templates — image models are unreliable at precise in-image text,
// especially Arabic.
const STYLE_SUFFIX =
  'clean studio lighting, soft shadows, high detail, photorealistic, e-commerce product photography style. ' +
  'Absolutely no text, no words, no letters, no numbers, no logos, no watermarks, no typography anywhere in the image.';

@Injectable()
export class ReplicateImageService {
  private replicate: Replicate | null = null;

  // See AnthropicService for why this doesn't throw at construction time —
  // eagerly instantiated at app bootstrap via DI, so a missing key here
  // previously crashed every route in the API, not just this one.
  constructor(private configService: ConfigService) {}

  private getClient(): Replicate {
    if (this.replicate) return this.replicate;
    const apiKey = this.configService.get<string>('REPLICATE_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException('REPLICATE_API_KEY is not configured. Please set it in .env file');
    }
    this.replicate = new Replicate({ auth: apiKey });
    return this.replicate;
  }

  // Generates `variations.length` photos for one page in a single "session" —
  // same seed across all of them so they read as one coherent shoot (same
  // lighting/mood/color grading) instead of visually mismatched stock photos.
  async generateProductPhotos(productDescription: string, variations: string[]): Promise<Buffer[]> {
    const client = this.getClient();
    const seed = Math.floor(Math.random() * 1_000_000);
    const buffers: Buffer[] = [];

    for (const variation of variations) {
      const prompt = `${productDescription}, ${variation}, ${STYLE_SUFFIX}`;
      try {
        const output: any = await client.run('black-forest-labs/flux-schnell', {
          input: {
            prompt,
            seed,
            aspect_ratio: '1:1',
            output_format: 'webp',
            num_outputs: 1,
          },
        });
        const url = Array.isArray(output) ? output[0] : output;
        if (!url) throw new Error('لم يتم إرجاع رابط الصورة من نموذج التوليد');

        const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 60000 });
        buffers.push(Buffer.from(response.data));
      } catch (error) {
        throw new InternalServerErrorException(`فشل توليد صورة المنتج: ${error.message}`);
      }
    }

    return buffers;
  }
}
