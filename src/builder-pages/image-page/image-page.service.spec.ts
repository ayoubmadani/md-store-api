import { ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { ImagePageService, styleForCategory } from './image-page.service';

const good = `<!doctype html><html><body>${'<section class="s" id="a">x</section>'.repeat(4)}</body></html>`;
const bad = `<!doctype html><html><body><section class="s">x</section></body></html>`;
const form = { title: 't', buttonText: 'b', backgroundColor: '#fff', textColor: '#000', buttonBackgroundColor: '#f00', buttonTextColor: '#fff', inputBackgroundColor: '#fff', inputBorderColor: '#ccc', inputTextColor: '#000', containerBackgroundColor: '#eee' };

function setup(outputs: { html: string }[], product: any = null) {
  const anthropic = { generateImagePage: jest.fn() };
  outputs.forEach((o) => anthropic.generateImagePage.mockResolvedValueOnce({ html: o.html, form, formAfter: 3 }));
  const pages = { findOne: jest.fn().mockResolvedValue({ id: 'p1', storeId: 's1' }) };
  const productRepo = { findOne: jest.fn().mockResolvedValue(product) };
  const s3 = { uploadBuffer: jest.fn().mockImplementation((_b: Buffer, key: string) => Promise.resolve({ key, url: `https://cdn/${key}` })) };
  const quota = { consume: jest.fn().mockImplementation((_u: string, _m: any, run: () => Promise<any>) => run()) };
  const svc = new ImagePageService(pages as any, productRepo as any, anthropic as any, s3 as any, quota as any, 'secret');
  return { svc, anthropic, quota, s3, productRepo };
}
const dto = { description: 'فستان قطني', language: 'ar' as const, style: 'فاخر', palette: ['#112233'], cutouts: 2, details: 1 };

describe('ImagePageService.generate', () => {
  it('retries once then succeeds', async () => {
    const { svc, anthropic } = setup([{ html: bad }, { html: good }]);
    const res = await svc.generate('p1', dto, 'u1');
    expect(anthropic.generateImagePage).toHaveBeenCalledTimes(2);
    expect(anthropic.generateImagePage.mock.calls[1][1]).toContain('عدد الأقسام');
    expect(res.html).toBe(good);
    expect(res.formAfter).toBe(3);
    expect(res.generationId).toMatch(/^[0-9a-f-]{36}\.[A-Za-z0-9_-]+$/);
  });

  it('second invalid → 422 and nothing consumed', async () => {
    const { svc, quota } = setup([{ html: bad }, { html: bad }]);
    let consumedResult: any = 'not-called';
    quota.consume.mockImplementation(async (_u: string, _m: any, run: () => Promise<any>) => { consumedResult = await run(); return consumedResult; });
    await expect(svc.generate('p1', dto, 'u1')).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(consumedResult).toBe('not-called');
  });

  it('style auto maps from category', () => {
    expect(styleForCategory('Sport & fitness')).toBe('رياضي');
    expect(styleForCategory('ألعاب الأطفال')).toBe('أطفال');
    expect(styleForCategory('عطور')).toBe('فاخر');
    expect(styleForCategory(undefined)).toBe('عصري بسيط');
  });

  it('price/variants come from product when productId given', async () => {
    const product = { id: 'pr', name: 'حذاء', desc: '<p>مريح</p>', price: 4500, priceOriginal: 5900, store: { id: 's1' }, category: { name: 'أحذية' },
      attributes: [{ name: 'المقاس', variants: [{ name: '40' }, { name: '41' }] }] };
    const { svc, anthropic } = setup([{ html: good }], product);
    await svc.generate('p1', { ...dto, description: undefined, productId: '11111111-1111-1111-1111-111111111111' }, 'u1');
    const user = anthropic.generateImagePage.mock.calls[0][1];
    for (const s of ['حذاء', '4500', '5900', 'المقاس: 40، 41', 'مريح']) expect(user).toContain(s);
    expect(user).not.toContain('<p>');
  });
});

describe('ImagePageService.uploadSections', () => {
  it('uploads with a valid token and rejects a forged one', async () => {
    const { svc, s3 } = setup([{ html: good }]);
    const { generationId } = await svc.generate('p1', dto, 'u1');
    const files = [{ buffer: Buffer.from('a'), mimetype: 'image/webp', size: 10 }, { buffer: Buffer.from('b'), mimetype: 'image/jpeg', size: 10 }] as any;
    const { urls } = await svc.uploadSections('p1', generationId, files, 'u1');
    expect(urls).toHaveLength(2);
    expect(s3.uploadBuffer.mock.calls[0][1]).toMatch(/^image-pages\/s1\/[0-9a-f-]{36}\/1\.webp$/);
    expect(s3.uploadBuffer.mock.calls[1][1]).toMatch(/\/2\.jpg$/);
    await expect(svc.uploadSections('p1', generationId, files, 'other-user')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.uploadSections('p1', generationId.replace(/.$/, 'x'), files, 'u1')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
