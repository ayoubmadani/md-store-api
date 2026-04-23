// image-admin.controller.ts
import { Controller, Get, Post, Query, UseInterceptors, UploadedFiles, ParseFilePipe, MaxFileSizeValidator, FileTypeValidator, Delete, Param } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ImageService } from './image.service';

@Controller('admin-images') // مسار مختلف لتجنب أي تداخل
export class ImageAdminController {
  constructor(private readonly imageService: ImageService) {}

  @Post()
  @UseInterceptors(FilesInterceptor('files', 10))
  async upload(@UploadedFiles(new ParseFilePipe({
    validators: [
      new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }),
      new FileTypeValidator({ fileType: /image\/(jpg|jpeg|png|webp|svg\+xml)$/ }),
    ],
  })) files: Express.Multer.File[]) {
    return await this.imageService.uploadImageAdmin(files);
  }

  @Get()
  async findAll(@Query('take') page?: string) {
    return this.imageService.getAllImagesAdmin(page);
  }

  @Delete(':id')
  deleteImageAdmin(
    @Param('id') id:string
  ){
    return this.imageService.deleteImageAdmin(id)
  }
}