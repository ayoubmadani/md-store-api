import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { BuilderPagesService } from './builder-pages.service';
import { CreateBuilderPageDto } from './dto/create-builder-page.dto';
import { UpdateTreeDto } from './dto/update-tree.dto';
import { GenerateBuilderPageDto } from './dto/generate-builder-page.dto';
import { AuthGuard } from '../auth/guard/auth.guard';

// No class-level guard (unlike before) — mirrors LandingPageController's
// pattern of guarding only the merchant-management routes individually,
// since a real storefront visitor (never logged into the dashboard) needs
// to reach `find`/`product-info` for a published page to render at all.
@Controller('builder-pages')
export class BuilderPagesController {
  constructor(private readonly builderPagesService: BuilderPagesService) {}

  @Post()
  @UseGuards(AuthGuard)
  create(@Body() dto: CreateBuilderPageDto) {
    return this.builderPagesService.create(dto);
  }

  @Get('store/:storeId')
  @UseGuards(AuthGuard)
  getByStoreId(@Param('storeId') storeId: string) {
    return this.builderPagesService.getByStoreId(storeId);
  }

  // Public — resolves a published page's own domain (the same
  // "store.mdstore.top/lp/slug" shape as landing-page's `find`) for the
  // storefront to render. Declared before the `:id` route so "find" isn't
  // swallowed as an :id value.
  @Get('find')
  findByDomain(@Query('domain') domain: string) {
    return this.builderPagesService.findByDomain(domain);
  }

  @Post('generate-trial')
  @UseGuards(AuthGuard)
  generateTrial(@Body() dto: GenerateBuilderPageDto) {
    return this.builderPagesService.generateTrial(dto);
  }

  // Public — the storefront's productForm block needs this for real,
  // live pricing/stock/variants, the same way the editor's own preview does.
  @Get('product-info/:productId')
  getProductInfo(@Param('productId') productId: string) {
    return this.builderPagesService.getProductInfo(productId);
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  findOne(@Param('id') id: string) {
    return this.builderPagesService.findOne(id);
  }

  @Put(':id/tree')
  @UseGuards(AuthGuard)
  updateTree(@Param('id') id: string, @Body() dto: UpdateTreeDto) {
    return this.builderPagesService.updateTree(id, dto);
  }

  @Post(':id/publish')
  @UseGuards(AuthGuard)
  publish(@Param('id') id: string) {
    return this.builderPagesService.publish(id);
  }

  @Post(':id/generate')
  @UseGuards(AuthGuard)
  generate(@Param('id') id: string, @Body() dto: GenerateBuilderPageDto) {
    return this.builderPagesService.generate(id, dto);
  }

  // POST, not GET like the older landing-page module's equivalent route —
  // this one actually mutates state, so it shouldn't be a GET.
  @Post(':id/toggle-status')
  @UseGuards(AuthGuard)
  toggleStatus(@Param('id') id: string) {
    return this.builderPagesService.toggleStatus(id);
  }

  @Patch(':id/platform')
  @UseGuards(AuthGuard)
  updatePlatform(@Param('id') id: string, @Body('platform') platform: string) {
    return this.builderPagesService.updatePlatform(id, platform);
  }

  @Post(':id/duplicate')
  @UseGuards(AuthGuard)
  duplicate(@Param('id') id: string) {
    return this.builderPagesService.duplicate(id);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  remove(@Param('id') id: string) {
    return this.builderPagesService.remove(id);
  }
}
