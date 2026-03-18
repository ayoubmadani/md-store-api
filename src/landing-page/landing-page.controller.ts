import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { LandingPageService } from './landing-page.service';
import { CreateLandingPageDto } from './dto/create-landing-page.dto';
import { UpdateLandingPageDto } from './dto/update-landing-page.dto';
import { AuthGuard } from '../auth/guard/auth.guard';
import { GetUser } from '../user/decorator/get-user.decorator';

@Controller('landing-page')
export class LandingPageController {
  constructor(private readonly landingPageService: LandingPageService) { }

  @Post()
  @UseGuards(AuthGuard)
  create(@Body() dto: CreateLandingPageDto , @GetUser() user: any) {
    const userId = user.id || user.sub
    return this.landingPageService.create(dto,userId);
  }

  @Get()
  findAll() {
    return this.landingPageService.findAll();
  }

  @Get(':domain')
  getByDomain(@Param('domain') domain: string) {
    return this.landingPageService.getByDomain(domain)
  }

  @Get('store/:storeId')

  getByStoreId(@Param('storeId') storeId: string) {
    return this.landingPageService.getByStoreId(storeId)
  }


  @Get('get-one/:id')
  @UseGuards(AuthGuard)

  findOne(@Param('id') id: string) {
    return this.landingPageService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  update(@Param('id') id: string, @Body() updateLandingPageDto: UpdateLandingPageDto) {

    return this.landingPageService.update(id, updateLandingPageDto);
  }

  @Get('toggle-status/:id')
  @UseGuards(AuthGuard)
  toggleStatus(@Param('id') id: string,@GetUser() user: any) {
        const userId = user.id || user.sub

    return this.landingPageService.toggleStatus(id , userId)
  }

  @Post('duplicate/:id')
  @UseGuards(AuthGuard)
  duplicate(@Param('id') id: string) {
    return this.landingPageService.duplicate(id)
  }

  @Patch('update-platform/:id')
  updatePlatform(
    @Param('id') id:string,
    @Body('platform') platform : string
  ){
    return this.landingPageService.updatePlatfor(id, platform)
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  remove(@Param('id') id: string) {
    return this.landingPageService.remove(id);
  }

  @Post('generate-product-image/:productId')
  @UseGuards(AuthGuard)
  generateProductImage(
    @Param('productId') productId: string,
    @GetUser() user: any
  ) {
    const userId = user.id
    return this.landingPageService.generateProductImage(productId)
  }
}
