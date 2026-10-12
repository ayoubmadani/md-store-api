import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { LandingPageService } from './landing-page.service';
import { CreateLandingPageDto } from './dto/create-landing-page.dto';
import { UpdateLandingPageDto } from './dto/update-landing-page.dto';
import { AuthGuard } from '../auth/guard/auth.guard';
import { GetUser } from '../user/decorator/get-user.decorator';
import { SuperAdminGuard } from '../admin/guard/super-admin.guard';

const userIdOf = (user: any): string => user.id || user.sub;

@Controller('landing-page')
export class LandingPageController {
  constructor(private readonly landingPageService: LandingPageService) { }

  @Post()
  @UseGuards(AuthGuard)
  async create(@Body() dto: CreateLandingPageDto, @GetUser() user: any) {
    await this.landingPageService.assertProductOwner(dto.productId, userIdOf(user));
    return this.landingPageService.create(dto, userIdOf(user));
  }

  // كل صفحات كل المتاجر — لمدير المنصة فقط
  @Get()
  @UseGuards(SuperAdminGuard)
  findAll() {
    return this.landingPageService.findAll();
  }

  // عام: يستعمله المتجر لعرض الصفحة على دومينها
  @Get('find') // تغيير المسار ليتماشى مع الاستعلام ويمنع التداخل مع findAll
  getByDomain(@Query('domain') domain: string) {
    return this.landingPageService.getByDomain(domain);
  }

  @Get('store/:storeId')
  @UseGuards(AuthGuard)
  async getByStoreId(@Param('storeId') storeId: string, @GetUser() user: any) {
    await this.landingPageService.assertStoreOwner(storeId, userIdOf(user));
    return this.landingPageService.getByStoreId(storeId)
  }

  @Get('get-one/:id')
  @UseGuards(AuthGuard)
  async findOne(@Param('id') id: string, @GetUser() user: any) {
    await this.landingPageService.assertOwner(id, userIdOf(user));
    return this.landingPageService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  async update(@Param('id') id: string, @Body() updateLandingPageDto: UpdateLandingPageDto, @GetUser() user: any) {
    await this.landingPageService.assertOwner(id, userIdOf(user));
    return this.landingPageService.update(id, updateLandingPageDto);
  }

  @Get('toggle-status/:id')
  @UseGuards(AuthGuard)
  async toggleStatus(@Param('id') id: string, @GetUser() user: any) {
    await this.landingPageService.assertOwner(id, userIdOf(user));
    return this.landingPageService.toggleStatus(id, userIdOf(user))
  }

  @Post('duplicate/:id')
  @UseGuards(AuthGuard)
  async duplicate(@Param('id') id: string, @GetUser() user: any) {
    await this.landingPageService.assertOwner(id, userIdOf(user));
    return this.landingPageService.duplicate(id)
  }

  @Patch('update-platform/:id')
  @UseGuards(AuthGuard)
  async updatePlatform(
    @Param('id') id: string,
    @Body('platform') platform: string,
    @GetUser() user: any,
  ) {
    await this.landingPageService.assertOwner(id, userIdOf(user));
    return this.landingPageService.updatePlatfor(id, platform)
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  async remove(@Param('id') id: string, @GetUser() user: any) {
    await this.landingPageService.assertOwner(id, userIdOf(user));
    return this.landingPageService.remove(id);
  }

  @Post('generate-product-image/:productId')
  @UseGuards(AuthGuard)
  async generateProductImage(
    @Param('productId') productId: string,
    @GetUser() user: any
  ) {
    await this.landingPageService.assertProductOwner(productId, userIdOf(user));
    return this.landingPageService.generateProductImage(productId)
  }
}
