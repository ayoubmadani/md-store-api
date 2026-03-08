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
  app.enableCors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        'http://localhost:5173',
        'http://localhost:3000',
        'https://mdstore.vercel.app'
      ];
      
      if (!origin || allowedOrigins.some(domain => origin.startsWith(domain)) || origin.includes('127.0.0.1')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type, Accept, Authorization, signature', // أضف signature هنا
  });

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