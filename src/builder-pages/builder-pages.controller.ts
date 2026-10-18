import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Put, Query, Res, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import type { Response } from 'express';
import { FilesInterceptor } from '@nestjs/platform-express';
import { IsOptional, IsUUID, ValidateIf } from 'class-validator';
import { BuilderPagesService } from './builder-pages.service';
import { CreateBuilderPageDto } from './dto/create-builder-page.dto';
import { UpdateTreeDto } from './dto/update-tree.dto';
import { GenerateBuilderPageDto } from './dto/generate-builder-page.dto';
import { GenerateImagePageDto } from './dto/generate-image-page.dto';
import { ImagePageService } from './image-page/image-page.service';
import { AuthGuard } from '../auth/guard/auth.guard';
import { GetUser } from '../user/decorator/get-user.decorator';
import { AllowApiKey } from '../auth/decorator/allow-api-key.decorator';

// No class-level guard (unlike before) — mirrors LandingPageController's
// pattern of guarding only the merchant-management routes individually,
// since a real storefront visitor (never logged into the dashboard) needs
// to reach `find`/`product-info` for a published page to render at all.
// منتج الصفحة (null = بدون منتج)
class UpdatePageProductDto {
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  productId?: string | null;
}

@Controller('builder-pages')
export class BuilderPagesController {
  constructor(
    private readonly builderPagesService: BuilderPagesService,
    private readonly imagePageService: ImagePageService,
  ) {}

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
  @AllowApiKey()
  create(@Body() dto: CreateBuilderPageDto, @GetUser() user: any) {
    return this.builderPagesService.create(dto, this.getUserId(user));
  }

  @Get('store/:storeId')
  @AllowApiKey()
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

  // صفحات الصور: الاستعمال هذا الشهر — قبل مسارات :id حتى لا تُقرأ "image-pages" كمعرّف
  @Get('image-pages/usage')
  @UseGuards(AuthGuard)
  imagePagesUsage(@GetUser() user: any) {
    return this.imagePageService.usage(this.getUserId(user));
  }

  // Public — the storefront's productForm block needs this for real,
  // live pricing/stock/variants, the same way the editor's own preview does.
  @Get('product-info/:productId')
  getProductInfo(@Param('productId') productId: string) {
    return this.builderPagesService.getProductInfo(productId);
  }

  @Get(':id')
  @AllowApiKey()
  @UseGuards(AuthGuard)
  findOne(@Param('id') id: string, @GetUser() user: any) {
    return this.builderPagesService.findOne(id, this.getUserId(user));
  }

  @Put(':id/tree')
  @UseGuards(AuthGuard)
  @AllowApiKey()
  updateTree(@Param('id') id: string, @Body() dto: UpdateTreeDto, @GetUser() user: any) {
    return this.builderPagesService.updateTree(id, dto, this.getUserId(user));
  }

  @Post(':id/publish')
  @AllowApiKey()
  @UseGuards(AuthGuard)
  publish(@Param('id') id: string, @GetUser() user: any) {
    return this.builderPagesService.publish(id, this.getUserId(user));
  }

  @Post(':id/generate')
  @UseGuards(AuthGuard)
  generate(@Param('id') id: string, @Body() dto: GenerateBuilderPageDto, @GetUser() user: any) {
    return this.builderPagesService.generate(id, dto, this.getUserId(user));
  }

  // تصميم صفحة صور: HTML + ألوان النموذج (التصوير والرفع في المتصفح)
  @Post(':id/generate-image-page')
  @UseGuards(AuthGuard)
  generateImagePage(@Param('id', ParseUUIDPipe) id: string, @Body() dto: GenerateImagePageDto, @GetUser() user: any) {
    return this.imagePageService.generate(id, dto, this.getUserId(user));
  }

  @Get(':id/image-page-product-photo')
  @UseGuards(AuthGuard)
  async imagePageProductPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('productId', ParseUUIDPipe) productId: string,
    @Query('n', ParseIntPipe) n: number,
    @GetUser() user: any,
    @Res() res: Response,
  ) {
    const { buffer, contentType } = await this.imagePageService.productPhoto(id, productId, n, this.getUserId(user));
    res.set({ 'Content-Type': contentType, 'Cache-Control': 'private, max-age=300' }).send(buffer);
  }

  @Post(':id/image-page-sections')
  @UseGuards(AuthGuard)
  @UseInterceptors(FilesInterceptor('files', 6, { limits: { fileSize: 2 * 1024 * 1024 } }))
  uploadImagePageSections(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('generationId') generationId: string,
    @Body('startIndex') startIndex: string,
    @UploadedFiles() files: Express.Multer.File[],
    @GetUser() user: any,
  ) {
    return this.imagePageService.uploadSections(id, generationId, files, this.getUserId(user), Number(startIndex) || 0);
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

  @Patch(':id/product')
  @AllowApiKey()
  @UseGuards(AuthGuard)
  updateProduct(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePageProductDto, @GetUser() user: any) {
    return this.builderPagesService.updateProduct(id, dto.productId ?? null, this.getUserId(user));
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
