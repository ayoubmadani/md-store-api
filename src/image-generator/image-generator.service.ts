import { Injectable } from '@nestjs/common';
import puppeteer from 'puppeteer';

export interface GenerateLandingImageDto {
  productImageBase64: string;
  headline: string;
  description: string;
  features: string[];
  price: string;
  badge?: string;
}

@Injectable()
export class ImageGeneratorService {

  async generateLandingImage(dto: GenerateLandingImageDto): Promise<Buffer> {
    const html = this.buildHtml(dto);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 480, height: 900 });
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const screenshot = await page.screenshot({
        type: 'png',
        fullPage: true,
      });

      return Buffer.from(screenshot);
    } finally {
      await browser.close();
    }
  }

  private buildHtml(dto: GenerateLandingImageDto): string {
    const featuresHtml = dto.features
      .map(f => `<li>✅ ${f}</li>`)
      .join('');

    const imgSrc = dto.productImageBase64
      ? `data:image/jpeg;base64,${dto.productImageBase64}`
      : 'https://via.placeholder.com/300x300?text=Product';

    return `
<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Cairo', sans-serif;
      background: linear-gradient(180deg, #f0f4ff 0%, #fff8f0 50%, #fef3e2 100%);
      width: 480px;
      overflow-x: hidden;
    }

    /* ── Badge ── */
    .badge {
      position: absolute;
      top: 20px;
      left: 20px;
      background: #2563eb;
      color: white;
      border-radius: 50%;
      width: 72px;
      height: 72px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
      text-align: center;
      z-index: 10;
      box-shadow: 0 4px 12px rgba(37,99,235,0.4);
    }

    /* ── Section 1: Hero ── */
    .hero {
      position: relative;
      background: linear-gradient(135deg, #e8f0fe, #f5f0ff);
      padding: 50px 30px 40px;
      text-align: center;
      min-height: 320px;
      overflow: hidden;
    }

    .hero h1 {
      font-size: 26px;
      font-weight: 900;
      color: #1a1a2e;
      margin-bottom: 10px;
      line-height: 1.4;
    }

    .hero p {
      font-size: 14px;
      color: #555;
      margin-bottom: 25px;
      line-height: 1.6;
    }

    .hero img {
      width: 75%;
      max-height: 220px;
      object-fit: contain;
      filter: drop-shadow(0 10px 25px rgba(0,0,0,0.15));
    }

    /* ── Bubbles ── */
    .bubble {
      position: absolute;
      border-radius: 50%;
      background: rgba(100,150,255,0.12);
      pointer-events: none;
    }

    /* ── Section 2: Features ── */
    .features {
      background: linear-gradient(135deg, #ffffff, #f0f7ff);
      padding: 40px 30px;
      text-align: center;
    }

    .features h2 {
      font-size: 22px;
      font-weight: 900;
      color: #1a1a2e;
      margin-bottom: 8px;
    }

    .features .sub {
      font-size: 13px;
      color: #666;
      margin-bottom: 20px;
      line-height: 1.6;
    }

    .features img {
      width: 65%;
      max-height: 180px;
      object-fit: contain;
      margin: 15px 0;
      filter: drop-shadow(0 8px 15px rgba(0,0,0,0.1));
    }

    .features ul {
      list-style: none;
      text-align: right;
      padding: 0 15px;
      margin-top: 10px;
    }

    .features ul li {
      font-size: 15px;
      color: #333;
      padding: 8px 0;
      font-weight: 600;
      border-bottom: 1px solid #f0f0f0;
    }

    .features ul li:last-child {
      border-bottom: none;
    }

    /* ── Section 3: Price ── */
    .price-section {
      background: linear-gradient(135deg, #fef3e2, #fde8c0);
      padding: 45px 30px;
      text-align: center;
    }

    .price-section .cta-text {
      font-size: 16px;
      font-weight: 700;
      color: #92400e;
      margin-bottom: 20px;
    }

    .price-section img {
      width: 60%;
      max-height: 160px;
      object-fit: contain;
      margin-bottom: 25px;
      filter: drop-shadow(0 8px 15px rgba(0,0,0,0.1));
    }

    .price-badge {
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: white;
      font-size: 38px;
      font-weight: 900;
      padding: 16px 44px;
      border-radius: 14px;
      display: inline-block;
      margin-bottom: 22px;
      box-shadow: 0 6px 20px rgba(245,158,11,0.45);
      letter-spacing: 1px;
    }

    .delivery {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-size: 14px;
      color: #78350f;
      margin-bottom: 20px;
      font-weight: 600;
    }

    .btn-buy {
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      color: white;
      border: none;
      padding: 16px 64px;
      border-radius: 50px;
      font-size: 18px;
      font-family: 'Cairo', sans-serif;
      font-weight: 700;
      cursor: pointer;
      box-shadow: 0 6px 20px rgba(37,99,235,0.4);
      display: inline-block;
    }
  </style>
</head>
<body>

  <!-- SECTION 1: HERO -->
  <div class="hero">
    ${dto.badge ? `<div class="badge">${dto.badge}</div>` : ''}
    <div class="bubble" style="width:90px;height:90px;top:-10px;right:-10px;"></div>
    <div class="bubble" style="width:50px;height:50px;bottom:30px;left:20px;"></div>
    <div class="bubble" style="width:30px;height:30px;top:60px;left:60px;"></div>
    <h1>${dto.headline}</h1>
    <p>${dto.description}</p>
    <img src="${imgSrc}" alt="product" />
  </div>

  <!-- SECTION 2: FEATURES -->
  <div class="features">
    <h2>مميزات المنتج</h2>
    <p class="sub">${dto.description}</p>
    <img src="${imgSrc}" alt="product" />
    <ul>${featuresHtml}</ul>
  </div>

  <!-- SECTION 3: PRICE -->
  <div class="price-section">
    <p class="cta-text">🔥 اطلبه الآن، الكمية محدودة!</p>
    <img src="${imgSrc}" alt="product" />
    <div><div class="price-badge">${dto.price}</div></div>
    <div class="delivery">🚚 التوصيل متاح لجميع الولايات</div>
    <div class="btn-buy">اشتري الآن</div>
  </div>

</body>
</html>`;
  }
}