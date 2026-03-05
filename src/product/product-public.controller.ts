import { Controller, Get, Param, ParseIntPipe, Query } from "@nestjs/common";
import { ProductService } from "./product.service";

@Controller('products') // مسار عام للمنتجات
export class ProductPublicController {
  constructor(private readonly productService: ProductService) { }

  // ======================================================
  // 🌍 مسارات الزوار (Public - لا تحتاج تسجيل دخول)
  // ======================================================

  // في ملف product.controller.ts

  // مسارات عامة للزوار (Public Routes)
  // نضعها قبل المسارات المحمية أو نلغي عنها الـ Guard

  @Get('public/:subdomain')
  async findAllByDomain(
    @Param('subdomain') subdomain: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
  ) {
    return this.productService.findAllByDomain(
      subdomain,
      page,
      limit,
      categoryId,
      search
    );
  }

  @Get('public/:subdomain/:productId')
  async findOneByDomain(
    @Param('subdomain') subdomain: string,
    @Param('productId') productId: string, // قد يكون ID أو Slug
  ) {
    return this.productService.findOneByDomain(subdomain, productId);
  }

  @Get(':productId/variants')
  getVariants(@Param('productId') productId : string){
    return this.productService.getVariants(productId)
  }

  @Get(':productId/offers')
  getOffers(@Param('productId') productId : string){
    return this.productService.getOffers(productId)
  }
}