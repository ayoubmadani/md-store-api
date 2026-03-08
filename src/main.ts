import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { json, urlencoded } from 'express';

async function bootstrap() {
  // 1. تفعيل خاصية rawBody عند إنشاء التطبيق
  const app = await NestFactory.create(AppModule, {
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

  const port = process.env.PORT || 7000;
  await app.listen(port);
}
bootstrap();