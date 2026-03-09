// niche.controller.ts
import { Controller, Get, Post, Body, Param, Patch, Delete } from '@nestjs/common';
import { NicheService } from './niche.service';
import { CreateNicheDto } from './dto/create-niche.dto';
import { UpdateNicheDto } from './dto/update-niche.dto';

@Controller('niches')
export class NicheController {
  constructor(private readonly nicheService: NicheService) {}

  // إنشاء Niche جديد
  @Post()
  async create(@Body() createNicheDto: CreateNicheDto[]) {
    const niche = await this.nicheService.create(createNicheDto);
    return {
      success: true,
      data: niche,
    };
  }

  // جلب كل الـ Niches
  @Get()
  async findAll() {
    const niches = await this.nicheService.findAll();
    return {
      success: true,
      data: niches,
    };
  }

  // جلب Niche واحدة بالـ id
  @Get(':id')
  async findOne(@Param('id') id: string) {
    const niche = await this.nicheService.findOne(id);
    return {
      success: true,
      data: niche,
    };
  }

  // تحديث Niche
  @Patch(':id')
  async update(@Param('id') id: string, @Body() updateNicheDto: UpdateNicheDto) {
    const niche = await this.nicheService.update(id, updateNicheDto);
    return {
      success: true,
      data: niche,
    };
  }

  // حذف Niche
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.nicheService.remove(id);
    return {
      success: true,
      message: `Niche with id ${id} deleted successfully`,
    };
  }
}