import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
// ✅ إنشاء instance واحد من express
const server = express();

// ✅ متغير global للتأكد من تهيئة التطبيق مرة واحدة فقط (Hot Reload في التطوير)
let cachedApp: any;

async function bootstrap() {
  // إذا كان التطبيق مهيأ مسبقاً، أعده مباشرة
  if (cachedApp) {
    return cachedApp;
  }

  // 1. تفعيل خاصية rawBody عند إنشاء التطبيق
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    rawBody: true,
  });

  // 2. تحديث إعدادات body-parser لالتقاط البيانات الخام (Buffer)
  // هذا الجزء ضروري جداً لكي تعمل دالة verifySignature الخاصة بـ Chargily
  app.use(json({
    limit: '50mb',
    verify: (req: any, res, buf) => {
      if (buf && buf.length) {
        req.rawBody = buf; // تخزين البيانات الخام في req.rawBody
      }
    },
  }));

  app.use(urlencoded({ extended: true, limit: '50mb' }));

  // 3. تفعيل الـ CORS
  app.enableCors();

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // ✅ لا نستخدم app.listen() في Vercel
  await app.init();

  // تخزين التطبيق للاستخدام المستقبلي
  cachedApp = server;
  
  return server;
}

// ✅ تصدير للتشغيل المحلي (اختياري)
if (process.env.NODE_ENV !== 'production') {
  bootstrap().then((server) => {
    const port = process.env.PORT || 7000;
    server.listen(port, () => {
      console.log(`🚀 Server running on http://localhost:${port}`);
    });
  });
}

// ✅ تصدير الـ handler للـ Vercel (مطلوب)
export default async function handler(req: any, res: any) {
  const app = await bootstrap();
  return app(req, res);
}