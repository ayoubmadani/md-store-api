import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { json, urlencoded } from 'express';

const listUrl = []

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. حل مشكلة حجم البيانات (Payload Too Large) - يجب أن يكون في البداية
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  // 2. تفعيل الـ CORS بشكل صحيح
  app.enableCors({
    origin: (origin, callback) => {
      // السماح بطلبات localhost أو الطلبات بدون origin (مثل Postman)
      if (!origin || origin.startsWith('http://localhost') || origin.includes('127.0.0.1')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type, Accept, Authorization',
  });

  // 3. الإعدادات العالمية للـ Validation
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
  }));

  // 4. تفعيل الـ Interceptors (للتحكم في ما يظهر من الـ Entity)
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // 5. تشغيل السيرفر على المنفذ 7000
  await app.listen(7000);
  console.log(`🚀 Server is running on: http://localhost:7000`);
}
bootstrap();