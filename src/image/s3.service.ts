import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto'; // ← استبدال uuid
import sharp from 'sharp';

// صور المتجر تُعرض على الهاتف — نصغّرها لعرض 1600 كحد أقصى ونحوّلها WebP (عادةً أخف 5-10 مرات)
const COMPRESSIBLE = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
async function compressImage(file: Express.Multer.File): Promise<{ buffer: Buffer; mimeType: string; ext: string } | null> {
  if (!COMPRESSIBLE.includes(file.mimetype) || !file.buffer?.length) return null;
  try {
    const out = await sharp(file.buffer, { failOn: 'none' })
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    return out.length < file.buffer.length ? { buffer: out, mimeType: 'image/webp', ext: 'webp' } : null;
  } catch {
    return null;
  }
}

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

    const compressed = await compressImage(file);
    const body = compressed?.buffer ?? file.buffer;
    const mimeType = compressed?.mimeType ?? file.mimetype;
    const fileExtension = compressed?.ext ?? file.originalname.split('.').pop();
    const fileName = `${randomUUID()}.${fileExtension}`; // ← استخدام crypto.randomUUID()
    const key = `${folder}/${fileName}`;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: body,
        ContentType: mimeType,
        CacheControl: 'public, max-age=31536000, immutable',
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
        mimeType,
        size: body.length,
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

  // Upload arbitrary content at an explicit key — unlike uploadFile(), the
  // caller controls the key (needed when the key encodes meaning, e.g.
  // builder-pages/{storeId}/{pageId}-{timestamp}.js) rather than an
  // auto-generated random filename.
  async uploadBuffer(buffer: Buffer, key: string, contentType: string): Promise<{ key: string; url: string }> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      });

      await this.s3Client.send(command);

      const publicUrl = this.configService.get<string>('AWS_PUBLIC_URL');
      const url = publicUrl
        ? `${publicUrl.replace(/\/$/, '')}/${key}`
        : `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;

      return { key, url };
    } catch (error) {
      console.error('S3 Upload Error:', error);
      throw new InternalServerErrorException('حدث خطأ أثناء رفع الملف إلى السيرفر');
    }
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