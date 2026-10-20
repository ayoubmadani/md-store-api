import { BadGatewayException, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';

// إزالة خلفية صور صفحة الصور على الخادم: BiRefNet (رخصة MIT) على Replicate.
// أدق من النموذج داخل المتصفح، ولا يجمّد صفحة التاجر. الناتج WebP شفاف (أصغر من PNG بكثير).
export const BIREFNET_VERSION = '21f2c4a9159af128ab9b9126401eebe7f8c5310841ed628b74a4c462df00da67'; // sprited/birefnet
const API = 'https://api.replicate.com/v1/predictions';
const DEADLINE_MS = 90_000;

type Prediction = { id?: string; status?: string; output?: string | string[]; error?: string; urls?: { get?: string } };

@Injectable()
export class ReplicateCutoutService {
  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly pollMs: number = 1500,
  ) { }

  private headers() {
    const key = this.config.get<string>('REPLICATE_API_KEY');
    if (!key) throw new BadGatewayException('إزالة الخلفية غير مهيأة (REPLICATE_API_KEY)');
    return { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  }

  private async call(url: string, init?: RequestInit): Promise<Prediction> {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(70_000) }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as Prediction & { detail?: string } | null;
    if (!res?.ok || !body) throw new BadGatewayException(`تعذّرت إزالة الخلفية${body?.detail ? `: ${body.detail}` : ''}`);
    return body;
  }

  async removeBackground(image: Buffer, mime: string): Promise<Buffer> {
    const headers = this.headers();
    let p = await this.call(API, {
      method: 'POST',
      headers: { ...headers, Prefer: 'wait=60' },
      body: JSON.stringify({
        version: BIREFNET_VERSION,
        input: { image: `data:${mime};base64,${image.toString('base64')}`, variant: 'general', output_format: 'cutout', refine_fg: true },
      }),
    });
    const started = Date.now();
    while (p.status !== 'succeeded' && p.status !== 'failed' && p.status !== 'canceled') {
      if (!p.urls?.get || Date.now() - started > DEADLINE_MS) throw new BadGatewayException('انتهت مهلة إزالة الخلفية، حاول مرة أخرى');
      await new Promise((r) => setTimeout(r, this.pollMs));
      p = await this.call(p.urls.get, { headers });
    }
    const url = Array.isArray(p.output) ? p.output[0] : p.output;
    if (p.status !== 'succeeded' || !url) throw new BadGatewayException(`تعذّرت إزالة الخلفية${p.error ? `: ${p.error}` : ''}`);

    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) }).catch(() => null);
    if (!res?.ok) throw new BadGatewayException('تعذّر تحميل الصورة بعد إزالة الخلفية');
    return sharp(Buffer.from(await res.arrayBuffer())).webp({ quality: 90, alphaQuality: 100 }).toBuffer();
  }
}
