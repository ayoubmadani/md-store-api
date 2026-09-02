import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { BuilderPagesService } from './builder-pages.service';
import { CreateBuilderPageDto } from './dto/create-builder-page.dto';
import { UpdateTreeDto } from './dto/update-tree.dto';
import { GenerateBuilderPageDto } from './dto/generate-builder-page.dto';
import { AuthGuard } from '../auth/guard/auth.guard';
import { GetUser } from '../user/decorator/get-user.decorator';

// No class-level guard (unlike before) — mirrors LandingPageController's
// pattern of guarding only the merchant-management routes individually,
// since a real storefront visitor (never logged into the dashboard) needs
// to reach `find`/`product-info` for a published page to render at all.
@Controller('builder-pages')
export class BuilderPagesController {
  constructor(private readonly builderPagesService: BuilderPagesService) {}

  // Every @UseGuards(AuthGuard) route below only proves the request carries
  // *a* valid token — it says nothing about whether that user owns the page
  // being touched. Each handler passes this id into the service, which
  // re-checks it against the page's own store before doing anything.
  private getUserId(user: any): string {
    const userId = user?.id || user?.sub;
    if (!userId) throw new BadRequestException('User ID not found in token');
    return userId;
  }

  @Post()
  @UseGuards(AuthGuard)
  create(@Body() dto: CreateBuilderPageDto, @GetUser() user: any) {
    return this.builderPagesService.create(dto, this.getUserId(user));
  }

  @Get('store/:storeId')
  @UseGuards(AuthGuard)
  getByStoreId(@Param('storeId') storeId: string, @GetUser() user: any) {
    return this.builderPagesService.getByStoreId(storeId, this.getUserId(user));
  }

  // Public — resolves a published page's own domain (the same
  // "store.mdstore.top/lp/slug" shape as landing-page's `find`) for the
  // storefront to render. Declared before the `:id` route so "find" isn't
  // swallowed as an :id value.
  @Get('find')
  findByDomain(@Query('domain') domain: string) {
    return this.builderPagesService.findByDomain(domain);
  }

  // Public — same shape as `find`, but keyed by id instead of the page's
  // own `domain` column. Used when a page is reached via a dedicated
  // Domain row (domains.scope = 'landing_page') pointing at it by id.
  @Get('public/:id')
  findPublicById(@Param('id') id: string) {
    return this.builderPagesService.findPublicById(id);
  }

  @Post('generate-trial')
  @UseGuards(AuthGuard)
  generateTrial(@Body() dto: GenerateBuilderPageDto) {
    return this.builderPagesService.generateTrial(dto);
  }

  // Backs the image block's own per-block "generate with AI" control —
  // independent of generate/generate-trial above, which generate a whole
  // page tree at once.
  @Post('generate-image')
  @UseGuards(AuthGuard)
  generateImage(@Body('prompt') prompt: string) {
    return this.builderPagesService.generateImageFromPrompt(prompt);
  }

  // Public — the storefront's productForm block needs this for real,
  // live pricing/stock/variants, the same way the editor's own preview does.
  @Get('product-info/:productId')
  getProductInfo(@Param('productId') productId: string) {
    return this.builderPagesService.getProductInfo(productId);
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  findOne(@Param('id') id: string, @GetUser() user: any) {
    return this.builderPagesService.findOne(id, this.getUserId(user));
  }

  @Put(':id/tree')
  @UseGuards(AuthGuard)
  updateTree(@Param('id') id: string, @Body() dto: UpdateTreeDto, @GetUser() user: any) {
    return this.builderPagesService.updateTree(id, dto, this.getUserId(user));
  }

  @Post(':id/publish')
  @UseGuards(AuthGuard)
  publish(@Param('id') id: string, @GetUser() user: any) {
    return this.builderPagesService.publish(id, this.getUserId(user));
  }

  @Post(':id/generate')
  @UseGuards(AuthGuard)
  generate(@Param('id') id: string, @Body() dto: GenerateBuilderPageDto, @GetUser() user: any) {
    return this.builderPagesService.generate(id, dto, this.getUserId(user));
  }

  // POST, not GET like the older landing-page module's equivalent route —
  // this one actually mutates state, so it shouldn't be a GET.
  @Post(':id/toggle-status')
  @UseGuards(AuthGuard)
  toggleStatus(@Param('id') id: string, @GetUser() user: any) {
    return this.builderPagesService.toggleStatus(id, this.getUserId(user));
  }

  @Patch(':id/platform')
  @UseGuards(AuthGuard)
  updatePlatform(@Param('id') id: string, @Body('platform') platform: string, @GetUser() user: any) {
    return this.builderPagesService.updatePlatform(id, platform, this.getUserId(user));
  }

  @Post(':id/duplicate')
  @UseGuards(AuthGuard)
  duplicate(@Param('id') id: string, @GetUser() user: any) {
    return this.builderPagesService.duplicate(id, this.getUserId(user));
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  remove(@Param('id') id: string, @GetUser() user: any) {
    return this.builderPagesService.remove(id, this.getUserId(user));
  }
}
