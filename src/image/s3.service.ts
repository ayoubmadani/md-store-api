import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto'; // ← استبدال uuid

@Injectable()
export class S3Service {
  private s3Client: any;
  private bucketName: string;
  private region: string;

  constructor(private configService: ConfigService) {
    this.region = this.configService.get<string>('AWS_REGION') || 'us-east-1';
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME') || '';

    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
    const endpoint = this.configService.get<string>('AWS_ENDPOINT');
    const forcePathStyle = this.configService.get<string>('AWS_FORCE_PATH_STYLE') === 'true';

    if (!accessKeyId || !secretAccessKey || !this.bucketName) {
      throw new Error(
        'AWS/MinIO credentials are not configured. Please set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET_NAME in .env file'
      );
    }

    const s3Config: any = {
      region: this.region,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle,
    };

    if (endpoint) {
      s3Config.endpoint = endpoint;
    }

    this.s3Client = new S3Client(s3Config);
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'uploads'
  ): Promise<{
    key: string;
    url: string;
    originalName: string;
    mimeType: string;
    size: number;
  }> {
    if (!file) {
      throw new BadRequestException('لم يتم إرفاق ملف');
    }

    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${randomUUID()}.${fileExtension}`; // ← استخدام crypto.randomUUID()
    const key = `${folder}/${fileName}`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await this.s3Client.send(command);

      const publicUrl = this.configService.get<string>('AWS_PUBLIC_URL');
      let url: string;

      if (publicUrl) {
        const cleanPublicUrl = publicUrl.replace(/\/$/, '');
        // حذفنا ${this.bucketName} لأن الـ Public URL موجه للـ bucket فعلياً
        url = `${cleanPublicUrl}/${key}`;
      } else {
        // هذا السطر يبقى كما هو كاحتياط لـ AWS S3 الأصلي
        url = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;
      }

      return {
        key,
        url,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      };
    } catch (error) {
      console.error('S3 Upload Error:', error);
      throw new InternalServerErrorException('حدث خطأ أثناء رفع الملف إلى السيرفر');
    }
  }

  async uploadMultipleFiles(
    files: Express.Multer.File[],
    folder: string = 'uploads'
  ): Promise<Array<{ key: string; url: string; originalName: string; mimeType: string; size: number }>> {
    const uploadPromises = files.map(file => this.uploadFile(file, folder));
    return Promise.all(uploadPromises);
  }

  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      await this.s3Client.send(command);
    } catch (error) {
      console.error('Error deleting from S3:', error);
      throw new InternalServerErrorException('فشل حذف الصورة من S3');
    }
  }

  async deleteMultipleFiles(keys: string[]): Promise<void> {
    const deletePromises = keys.map(key => this.deleteFile(key));
    await Promise.all(deletePromises);
  }
}