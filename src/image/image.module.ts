import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ImageService } from './image.service';
import { ImageController } from './image.controller';
import { Image } from './entities/image.entity';
import { S3Service } from './s3.service';
import { ImageAdmin } from './entities/image-admin.entity';
import { ImageAdminController } from './image-admin.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Image , ImageAdmin]),
    ConfigModule, // للوصول إلى متغيرات البيئة

  ],
  controllers: [ImageController , ImageAdminController],
  providers: [ImageService, S3Service],
  exports: [ImageService, S3Service], // تصدير للاستخدام في modules أخرى
})
export class ImageModule {}