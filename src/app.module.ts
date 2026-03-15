import { Module } from '@nestjs/common';
import { UserModule } from './user/user.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailModule } from './mail/mail.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { StoreModule } from './store/store.module';
import { CategoryModule } from './category/category.module';
import { LandingPageModule } from './landing-page/landing-page.module';
import { ProductModule } from './product/product.module';
import { NicheModule } from './niche/niche.module';
import { ImageProductModule } from './image-product/image-product.module';
import { ImageModule } from './image/image.module';
import { OrderModule } from './order/order.module';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ShippingModule } from './shipping/shipping.module';
import { AiModule } from './ai/ai.module';
import { ThemeModule } from './theme/theme.module';
import { AdminModule } from './admin/admin.module';
import { AppController } from './app.controller';
import { SubscriptionModule } from './subscription/subscription.module';
import { PaymentModule } from './payment/payment.module';
import { ShippingProviderModule } from './shipping-provider/shipping-provider.module';
import { ScheduleModule } from '@nestjs/schedule';
import { CronJobModule } from './cron-job/cron-job.module';

@Module({
  imports: [
    // 1. الإعدادات والـ Throttle
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    
    // ✅ يجب أن يكون هنا داخل مصفوفة الـ imports
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 3, // رفعناه قليلاً ليكون مناسباً للتصفح العادي
    }]),

    ScheduleModule.forRoot(),

    // 2. إعداد قاعدة البيانات
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: "postgres",
        url: config.get<string>('DATABASE_URL'),
        synchronize: config.get<string>('NODE_ENV') === 'development',
        autoLoadEntities: true,
      }),
    }),

    // 3. باقي الموديولات
    MailModule,
    UserModule,
    AuthModule,
    StoreModule,
    CategoryModule,
    LandingPageModule,
    ProductModule,
    NicheModule,
    ImageProductModule,
    ImageModule,
    OrderModule,
    ShippingModule,
    AiModule,
    ThemeModule,
    AdminModule,
    SubscriptionModule,
    PaymentModule,
    ShippingProviderModule,
    CronJobModule,
  ],
  controllers: [AppController]
})
export class AppModule { }