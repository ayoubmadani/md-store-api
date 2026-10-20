import { BadGatewayException } from '@nestjs/common';
import sharp from 'sharp';
import { ReplicateCutoutService, BIREFNET_VERSION } from './replicate-cutout.service';

const config = { get: (k: string) => (k === 'REPLICATE_API_KEY' ? 'r8_test' : undefined) } as any;
const png = () => sharp({ create: { width: 4, height: 4, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0.5 } } }).png().toBuffer();
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('ReplicateCutoutService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('sends the image to BiRefNet and returns a transparent webp', async () => {
    const out = await png();
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(json({ id: 'p1', status: 'succeeded', output: 'https://replicate.delivery/x.png' }))
      .mockResolvedValueOnce(new Response(new Uint8Array(out)));
    const webp = await new ReplicateCutoutService(config).removeBackground(Buffer.from('jpg'), 'image/jpeg');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.replicate.com/v1/predictions');
    const body = JSON.parse(init.body as string);
    expect(body.version).toBe(BIREFNET_VERSION);
    expect(body.input).toMatchObject({ variant: 'general', output_format: 'cutout', refine_fg: true });
    expect(body.input.image).toMatch(/^data:image\/jpeg;base64,/);
    expect((init.headers as any).Authorization).toBe('Bearer r8_test');
    const meta = await sharp(webp).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.hasAlpha).toBe(true);
  });

  it('polls until the prediction finishes', async () => {
    const out = await png();
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(json({ id: 'p1', status: 'processing', urls: { get: 'https://api.replicate.com/v1/predictions/p1' } }))
      .mockResolvedValueOnce(json({ id: 'p1', status: 'succeeded', output: ['https://replicate.delivery/x.png'] }))
      .mockResolvedValueOnce(new Response(new Uint8Array(out)));
    const svc = new ReplicateCutoutService(config, 0);
    await svc.removeBackground(Buffer.from('jpg'), 'image/jpeg');
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.replicate.com/v1/predictions/p1');
  });

  it('failure or no credit → BadGateway', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(json({ title: 'Insufficient credit', status: 402 }, 402));
    await expect(new ReplicateCutoutService(config).removeBackground(Buffer.from('x'), 'image/jpeg')).rejects.toBeInstanceOf(BadGatewayException);
    jest.spyOn(global, 'fetch').mockResolvedValueOnce(json({ id: 'p', status: 'failed', error: 'oom' }));
    await expect(new ReplicateCutoutService(config).removeBackground(Buffer.from('x'), 'image/jpeg')).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('waits and retries when Replicate throttles (429, low credit)', async () => {
    const out = await png();
    const fetchMock = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(json({ detail: 'Request was throttled', status: 429, retry_after: 1 }, 429))
      .mockResolvedValueOnce(json({ id: 'p1', status: 'succeeded', output: 'https://replicate.delivery/x.png' }))
      .mockResolvedValueOnce(new Response(new Uint8Array(out)));
    const webp = await new ReplicateCutoutService(config, 0).removeBackground(Buffer.from('jpg'), 'image/jpeg');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect((await sharp(webp).metadata()).format).toBe('webp');
  });
});
