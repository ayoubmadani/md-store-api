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
} from '@nestjs/common';
import { AuthGuard } from '../auth/guard/auth.guard';
import { ImageService } from './image.service';
import { GetUser } from '../user/decorator/get-user.decorator';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('images')
@UseGuards(AuthGuard) // أو AuthGuard حسب استراتيجيتك
export class ImageController {
  constructor(private readonly imageService: ImageService) {}

  @Get()
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

  @Get('stats')
  getStats(@GetUser() user: any) {
    const userId = user.id || user.sub || user.userId;
    if (!userId) {
      throw new BadRequestException('معرف المستخدم غير موجود في التوكن');
    }
    return this.imageService.getStats(userId);
  }

  @Get('search')
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

  @Get(':id')
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

  @Delete(':id')
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

  @Delete('batch')
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

  @Post('upload')
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
}