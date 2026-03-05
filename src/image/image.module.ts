import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ImageService } from './image.service';
import { ImageController } from './image.controller';
import { Image } from './entities/image.entity';
import { S3Service } from './s3.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Image]),
    ConfigModule, // للوصول إلى متغيرات البيئة
  ],
  controllers: [ImageController],
  providers: [ImageService, S3Service],
  exports: [ImageService, S3Service], // تصدير للاستخدام في modules أخرى
})
export class ImageModule {}