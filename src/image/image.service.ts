import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Image } from './entities/image.entity';
import { S3Service } from './s3.service';
import { count } from 'console';
import { ImageAdmin } from './entities/image-admin.entity';

@Injectable()
export class ImageService {
  constructor(
    @InjectRepository(Image)
    private imageRepository: Repository<Image>,

    @InjectRepository(ImageAdmin)
    private imageAdminRepository: Repository<ImageAdmin>,


    private s3Service: S3Service,
  ) { }

  /**
   * رفع صورة واحدة
   */
  async uploadSingle(
    file: Express.Multer.File,
    userId: string,
    folder: string = 'uploads'
  ): Promise<Image> {
    // رفع الملف إلى S3
    const uploadResult = await this.s3Service.uploadFile(file, folder);

    // حفظ معلومات الصورة في قاعدة البيانات
    const image = this.imageRepository.create({
      url: uploadResult.url,
      key: uploadResult.key,
      user: { id: userId }, // تمرير كائن User بدلاً من userId مباشر
      originalName: uploadResult.originalName,
      mimeType: uploadResult.mimeType,
      size: uploadResult.size,
      folder,
    });

    return this.imageRepository.save(image);
  }

  /**
   * رفع عدة صور
   */
  async uploadMultiple(
    files: Express.Multer.File[],
    userId: string,
    folder: string = 'uploads'
  ): Promise<Image[]> {
    // رفع جميع الملفات إلى S3
    const uploadResults = await this.s3Service.uploadMultipleFiles(files, folder);

    // حفظ معلومات جميع الصور في قاعدة البيانات
    const images = uploadResults.map(result =>
      this.imageRepository.create({
        url: result.url,
        key: result.key,
        user: { id: userId }, // تمرير كائن User بدلاً من userId مباشر
        originalName: result.originalName,
        mimeType: result.mimeType,
        size: result.size,
        folder,
      })
    );

    return this.imageRepository.save(images);
  }

  async findSumSize(userId: string) {
    const result = await this.imageRepository
      .createQueryBuilder("image")
      .select("COUNT(image.id)", "count")
      .addSelect("SUM(image.size)", "totalSize") // افترضنا وجود حقل باسم size
      .where("image.userId = :userId", { userId })
      .getRawOne();

    return {
      count: result.count,
      totalSize: parseInt(result.totalSize || 0)
    };
  }

  /**
   * جلب جميع صور المستخدم
   */
  async findAllByUser(
    userId: string,
    page: number = 1,
    limit: number = 50,
    folder?: string
  ): Promise<{
    images: Image[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const queryBuilder = this.imageRepository
      .createQueryBuilder('image')
      .leftJoinAndSelect('image.user', 'user')
      .where('user.id = :userId', { userId });

    if (folder) {
      queryBuilder.andWhere('image.folder = :folder', { folder });
    }

    queryBuilder
      .orderBy('image.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [images, total] = await queryBuilder.getManyAndCount();

    return {
      images,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * جلب صورة واحدة
   */
  async findOne(id: string, userId?: string): Promise<Image> {
    const image = await this.imageRepository.findOne({
      where: { id },
      relations: ['user'], // تحميل العلاقة للتحقق من الملكية
    });

    if (!image) {
      throw new NotFoundException(`الصورة #${id} غير موجودة`);
    }

    // التحقق من الملكية إذا تم تمرير userId
    if (userId && image.user?.id !== userId) {
      throw new ForbiddenException('ليس لديك صلاحية للوصول إلى هذه الصورة');
    }

    return image;
  }

  /**
   * حذف صورة
   */
  async remove(id: string, userId: string): Promise<{ message: string }> {
    const image = await this.findOne(id, userId);

    // حذف الصورة من S3
    await this.s3Service.deleteFile(image.key);

    // حذف السجل من قاعدة البيانات
    await this.imageRepository.remove(image);

    return { message: 'تم حذف الصورة بنجاح' };
  }

  /**
   * حذف عدة صور
   */
  async removeMultiple(ids: string[], userId: string): Promise<{ message: string; deletedCount: number }> {
    // البحث عن الصور مع التحقق من الملكية
    const images = await this.imageRepository
      .createQueryBuilder('image')
      .leftJoinAndSelect('image.user', 'user')
      .where('image.id IN (:...ids)', { ids })
      .andWhere('user.id = :userId', { userId })
      .getMany();

    if (images.length === 0) {
      throw new NotFoundException('لم يتم العثور على صور للحذف');
    }

    // حذف الصور من S3
    const keys = images.map(img => img.key);
    await this.s3Service.deleteMultipleFiles(keys);

    // حذف السجلات من قاعدة البيانات
    await this.imageRepository.remove(images);

    return {
      message: 'تم حذف الصور بنجاح',
      deletedCount: images.length,
    };
  }

  /**
   * البحث في الصور
   */
  async search(
    userId: string,
    searchTerm: string,
    folder?: string
  ): Promise<Image[]> {
    const queryBuilder = this.imageRepository
      .createQueryBuilder('image')
      .leftJoinAndSelect('image.user', 'user')
      .where('user.id = :userId', { userId })
      .andWhere('image.originalName ILIKE :searchTerm', {
        searchTerm: `%${searchTerm}%`
      });

    if (folder) {
      queryBuilder.andWhere('image.folder = :folder', { folder });
    }

    return queryBuilder
      .orderBy('image.createdAt', 'DESC')
      .getMany();
  }

  /**
   * جلب إحصائيات صور المستخدم
   */
  async getStats(userId: string) {
    const [totalImages, totalSize] = await Promise.all([
      this.imageRepository
        .createQueryBuilder('image')
        .leftJoin('image.user', 'user')
        .where('user.id = :userId', { userId })
        .getCount(),
      this.imageRepository
        .createQueryBuilder('image')
        .leftJoin('image.user', 'user')
        .select('SUM(image.size)', 'total')
        .where('user.id = :userId', { userId })
        .getRawOne(),
    ]);

    // حساب عدد الصور حسب المجلدات
    const folderStats = await this.imageRepository
      .createQueryBuilder('image')
      .leftJoin('image.user', 'user')
      .select('image.folder', 'folder')
      .addSelect('COUNT(image.id)', 'count')
      .where('user.id = :userId', { userId })
      .groupBy('image.folder')
      .getRawMany();

    return {
      totalImages,
      totalSize: totalSize?.total || 0,
      totalSizeMB: ((totalSize?.total || 0) / (1024 * 1024)).toFixed(2),
      folderStats,
    };
  }

  //------------------------------------------
  // admine
  //------------------------------------------


  async uploadImageAdmin(files: Express.Multer.File[]) {
    // 1. رفع الملفات إلى S3
    const uploadedFiles = await this.s3Service.uploadMultipleFiles(files, "admin");

    // 2. تحويل البيانات لتناسب هيكل جدول ImageAdmin
    const imageData = uploadedFiles.map(file => ({
      url: file.url,
      size: file.size,
      key: file.key,
    }));

    // 3. إنشاء السجلات وحفظها
    const imagesAdmin = this.imageAdminRepository.create(imageData);
    return await this.imageAdminRepository.save(imagesAdmin);
  }

  getAllImagesAdmin(page: string = "1") {
    const limit = 100; // عدد الصور في كل صفحة
    const pageNumber = Math.max(1, parseInt(page)); // التأكد من أن رقم الصفحة 1 أو أكثر

    return this.imageAdminRepository.find({
      // تخطي العناصر بناءً على الصفحة (مثلاً الصفحة 2 تتخطى أول 100 عنصر)
      skip: (pageNumber - 1) * limit,

      // جلب 100 عنصر فقط في كل مرة
      take: limit,

      // ترتيب الصور من الأحدث إلى الأقدم
      order: {
        id: 'DESC'
      }
    });
  }

  async deleteImageAdmin(id: string) {
    const image = await this.imageAdminRepository.findOne({ where: { id } })
    if (!image) throw new NotFoundException('image note found')
    await this.s3Service.deleteFile(image.key);
    await this.imageAdminRepository.remove(image)
    return { success: true }
  }

}