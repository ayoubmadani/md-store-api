import { SuperAdminGuard } from '../admin/guard/super-admin.guard';
import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ImageProductService } from './image-product.service';
import { CreateImageProductDto } from './dto/create-image-product.dto';
import { UpdateImageProductDto } from './dto/update-image-product.dto';

@Controller('image-product')
export class ImageProductController {
  constructor(private readonly imageProductService: ImageProductService) {}

  @Post()
  @UseGuards(SuperAdminGuard)
  create(@Body() createImageProductDto: CreateImageProductDto) {
    return this.imageProductService.create(createImageProductDto);
  }

  @Get()
  @UseGuards(SuperAdminGuard)
  findAll() {
    return this.imageProductService.findAll();
  }

  @Get(':id')
  @UseGuards(SuperAdminGuard)
  findOne(@Param('id') id: string) {
    return this.imageProductService.findOne(+id);
  }

  @Patch(':id')
  @UseGuards(SuperAdminGuard)
  update(@Param('id') id: string, @Body() updateImageProductDto: UpdateImageProductDto) {
    return this.imageProductService.update(+id, updateImageProductDto);
  }

  @Delete(':id')
  @UseGuards(SuperAdminGuard)
  remove(@Param('id') id: string) {
    return this.imageProductService.remove(+id);
  }
}
