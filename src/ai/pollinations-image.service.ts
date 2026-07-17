import { Injectable, InternalServerErrorException } from '@nestjs/common';
import axios from 'axios';

// AI's job here is strictly "photography, not design": clean, text-free
// product/lifestyle photos that get dropped into the page's image block
// `src` slot. Actual layout, typography, and branding stay with the block
// templates — image models are unreliable at precise in-image text,
// especially Arabic.
const STYLE_SUFFIX =
  'clean studio lighting, soft shadows, high detail, photorealistic, e-commerce product photography style. ' +
  'Absolutely no text, no words, no letters, no numbers, no logos, no watermarks, no typography anywhere in the image.';

// pollinations.ai — a free, keyless image-generation API (a single GET
// request returns the image bytes directly), used here instead of
// ReplicateImageService/flux-schnell specifically to avoid a paid,
// credit-metered account (see the "Insufficient credit" 402s that motivated
// this). Same public method signature as ReplicateImageService, so
// BuilderPagesService can call it exactly the same way.
@Injectable()
export class PollinationsImageService {
  private readonly baseUrl = 'https://image.pollinations.ai/prompt';

  // Generates `variations.length` photos for one page in a single "session" —
  // same seed across all of them so they read as one coherent shoot (same
  // lighting/mood/color grading) instead of visually mismatched stock photos.
  async generateProductPhotos(productDescription: string, variations: string[]): Promise<Buffer[]> {
    const seed = Math.floor(Math.random() * 1_000_000);
    const buffers: Buffer[] = [];

    for (const variation of variations) {
      const prompt = `${productDescription}, ${variation}, ${STYLE_SUFFIX}`;
      const url = `${this.baseUrl}/${encodeURIComponent(prompt)}`;

      try {
        const response = await axios.get(url, {
          responseType: 'arraybuffer',
          timeout: 60000,
          params: {
            width: 1024,
            height: 1024,
            seed,
            model: 'flux',
            nologo: true,
            enhance: false,
          },
        });
        buffers.push(Buffer.from(response.data));
      } catch (error) {
        throw new InternalServerErrorException(`فشل توليد صورة المنتج: ${error.message}`);
      }
    }

    return buffers;
  }
}
