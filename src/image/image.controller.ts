import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
  BadRequestException,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guard/auth.guard';
import { ImageService } from './image.service';
import { GetUser } from '../user/decorator/get-user.decorator';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';

@Controller('images')
export class ImageController {
  constructor(private readonly imageService: ImageService) { }

  @Get()
  @UseGuards(AuthGuard) // أو AuthGuard حسب استراتيجيتك

  findAll(
    @GetUser() user: any,
    @Query('page', new ParseIntPipe({ optional: true })) page: number = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number = 50,
    @Query('folder') folder?: string,

  ) {
    const userId = user.id || user.sub || user.userId;
    if (!userId) {
      throw new BadRequestException('معرف المستخدم غير موجود في التوكن');
    }

    // التأكد من أن limit لا يتجاوز 100 للأداء
    const safeLimit = Math.min(limit, 100);

    return this.imageService.findAllByUser(userId, page, safeLimit, folder);
  }

  @Get('get-size')
  @UseGuards(AuthGuard) // أو AuthGuard حسب استراتيجيتك

  findSumSize(@GetUser() user: any,) {
    const userId = user.id || user.sub || user.userId;
    return this.imageService.findSumSize(userId)
  }

  @Get('stats')
  @UseGuards(AuthGuard) // أو AuthGuard حسب استراتيجيتك

  getStats(@GetUser() user: any) {
    const userId = user.id || user.sub || user.userId;
    if (!userId) {
      throw new BadRequestException('معرف المستخدم غير موجود في التوكن');
    }
    return this.imageService.getStats(userId);
  }

  @Get('search')
  @UseGuards(AuthGuard) // أو AuthGuard حسب استراتيجيتك

  search(
    @GetUser() user: any,
    @Query('q') searchTerm: string,
    @Query('folder') folder?: string,

  ) {
    const userId = user.id || user.sub || user.userId;
    if (!userId) {
      throw new BadRequestException('معرف المستخدم غير موجود في التوكن');
    }
    if (!searchTerm || searchTerm.trim().length < 2) {
      throw new BadRequestException('كلمة البحث يجب أن تكون حرفين على الأقل');
    }
    return this.imageService.search(userId, searchTerm.trim(), folder);
  }

  // نفس السبب أعلاه: يجب أن يسبق @Get(':id') وإلا فلن يُنفَّذ أبداً
  @Get('image-admine')
  getAllImagesAdmin(
    @Query('take') take?: string
  ) {
    return this.imageService.getAllImagesAdmin(take)
  }

  @Get(':id')
  @UseGuards(AuthGuard) // أو AuthGuard حسب استراتيجيتك

  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: any
  ) {
    const userId = user.id || user.sub || user.userId;
    if (!userId) {
      throw new BadRequestException('معرف المستخدم غير موجود في التوكن');
    }
    return this.imageService.findOne(id, userId);
  }

  // يجب أن يسبق @Delete(':id') — وإلا فإن ':id' ستلتقط 'batch' كقيمة لها
  // (سلسلة نصية عادية بالنسبة لـ Express) قبل وصول الطلب لهذا المسار،
  // فيفشل التحقق من UUID دائماً ولا يُنفَّذ الحذف الجماعي أبداً
  @Delete('batch')
  @UseGuards(AuthGuard) // أو AuthGuard حسب استراتيجيتك

  removeMultiple(
    @Body('ids') ids: string[],
    @GetUser() user: any
  ) {
    const userId = user.id || user.sub || user.userId;
    if (!userId) {
      throw new BadRequestException('معرف المستخدم غير موجود في التوكن');
    }
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException('يجب توفير مصفوفة من المعرفات');
    }
    return this.imageService.removeMultiple(ids, userId);
  }

  @Delete(':id')
  @UseGuards(AuthGuard) // أو AuthGuard حسب استراتيجيتك

  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: any
  ) {
    const userId = user.id || user.sub || user.userId;
    if (!userId) {
      throw new BadRequestException('معرف المستخدم غير موجود في التوكن');
    }
    return this.imageService.remove(id, userId);
  }

  @Post('upload')
  @UseGuards(AuthGuard) // أو AuthGuard حسب استراتيجيتك

  @UseInterceptors(FileInterceptor('file')) // اسم الحقل في الـ Form-Data هو 'file'
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @GetUser() user: any,
    @Query('folder') folder: string = 'uploads'
  ) {
    const userId = user.id || user.sub || user.userId;
    if (!userId) {
      throw new BadRequestException('معرف المستخدم غير موجود');
    }

    if (!file) {
      throw new BadRequestException('يرجى اختيار ملف لرفعه');
    }

    // استدعاء الخدمة التي كتبناها سابقاً
    return this.imageService.uploadSingle(file, userId, folder);
  }

  //------------------------------------------
  // admine
  //------------------------------------------


  @Post('admine/upload')
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadAdminImages(
    @UploadedFiles(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          // التعديل هنا: استخدام Regex بسيط وشامل للصور
          new FileTypeValidator({ fileType: '.(png|jpeg|jpg|webp)$' }), 
        ],
        // هذا السطر سيجعل NestJS يخبرك صراحة إذا كانت المشكلة هي عدم وصول الملفات أصلاً
        fileIsRequired: true, 
      }),
    )
    files: Express.Multer.File[],
  ) {
    return await this.imageService.uploadImageAdmin(files);
  }

}