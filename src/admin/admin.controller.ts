import {
  Controller,
  Get,
  Patch,
  Delete,
  Post,
  Put,
  Param,
  Query,
  Body,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { UserRole } from '../user/entities/user.entity';
import { StatusEnum } from '../order/entities/order.entity';
import { AdminService } from './admine.service';
import { CreateMessageAdminDto } from './dto/message-admine.dto';
import { CreateCategoryNicheDto } from '../niche/dto/create-cat-niche.dto';

// ─────────────────────────────────────────────────────────────────────────────
// Query classes
// Must be CLASSES (not interfaces) — interfaces are erased at runtime and
// cannot carry emitDecoratorMetadata reflection info.
// ─────────────────────────────────────────────────────────────────────────────

export class PaginationQuery {
  page?: number;
  limit?: number;
}

export class DateRangeQuery {
  from?: string;
  to?: string;
}

// Combines both so a single @Query() captures all four params cleanly.
export class DateRangePaginationQuery {
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Body DTOs
// Concrete classes only — no Partial<Entity> in decorated signatures.
// ─────────────────────────────────────────────────────────────────────────────

export class UpdateRoleDto {
  role: UserRole;
}

export class UpdateOrderStatusDto {
  status: StatusEnum;
}

export class CreateNicheDto {
  name: string;
  icon: string;
}

export class UpdateNicheDto {
  name?: string;
  icon?: string;
}

export class CreateThemeTypeDto {
  name: string;
}

export class UpdateThemeTypeDto {
  name: string;
}

export class CreateThemeDto {
  name_en: string;
  name_ar: string;
  name_fr: string;
  slug: string;
  price: number;
  desc_en: string;
  desc_ar: string;
  desc_fr: string;
  imageUrl: string;
  tag?: string[];
  typeId: string;
  isActive?: boolean;
}

export class UpdateThemeDto {
  name_en?: string;
  name_ar?: string;
  name_fr?: string;
  slug?: string;
  price?: number;
  desc_en?: string;
  desc_ar?: string;
  desc_fr?: string;
  imageUrl?: string;
  tag?: string[];
  typeId?: string;
  isActive?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Controller
// ─────────────────────────────────────────────────────────────────────────────

@Controller('admin')
// @UseGuards(JwtAuthGuard, RolesGuard)   ← uncomment when auth is wired
// @Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) { }

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. DASHBOARD
  // GET /admin/dashboard/stats
  // GET /admin/dashboard/revenue?from=2024-01-01&to=2024-12-31
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('dashboard/stats')
  getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('dashboard/revenue')
  getRevenueChart(@Query() query: DateRangeQuery) {
    return this.adminService.getRevenueChart(query);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. USER MANAGEMENT
  // GET    /admin/users?page=&limit=
  // GET    /admin/users/search?q=john&page=&limit=
  // GET    /admin/users/:id
  // PATCH  /admin/users/:id/role
  // PATCH  /admin/users/:id/verify
  // DELETE /admin/users/:id
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('users')
  getAllUsers(@Query() pagination: PaginationQuery) {
    return this.adminService.getAllUsers(pagination);
  }

  @Get('users/search')
  searchUsers(
    @Query('q') query: string,
    @Query() pagination: PaginationQuery,
  ) {
    return this.adminService.searchUsers(query, pagination);
  }

  @Get('users/:id')
  getUserById(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getUserById(id);
  }

  @Patch('users/:id/role')
  updateUserRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.adminService.updateUserRole(id, dto.role);
  }

  @Patch('users/:id/verify')
  toggleUserVerification(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.toggleUserVerification(id);
  }

  @Delete('users/:id')
  @HttpCode(HttpStatus.OK)
  deleteUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.deleteUser(id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. STORE MANAGEMENT
  // GET    /admin/stores?page=&limit=
  // GET    /admin/stores/:id
  // GET    /admin/stores/:id/stats
  // PATCH  /admin/stores/:id/toggle
  // DELETE /admin/stores/:id
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('stores')
  getAllStores(@Query() pagination: PaginationQuery) {
    return this.adminService.getAllStores(pagination);
  }

  @Get('stores/:id')
  getStoreById(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getStoreById(id);
  }

  @Get('stores/:id/stats')
  getStoreStats(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getStoreStats(id);
  }

  @Patch('stores/:id/toggle')
  toggleStoreStatus(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.toggleStoreStatus(id);
  }

  @Delete('stores/:id')
  @HttpCode(HttpStatus.OK)
  deleteStore(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.deleteStore(id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. ORDER MANAGEMENT
  // GET    /admin/orders?page=&limit=
  // GET    /admin/orders/by-status?status=pending&page=&limit=
  // GET    /admin/orders/by-date?from=&to=&page=&limit=
  // GET    /admin/orders/wilaya-stats
  // GET    /admin/orders/:id
  // PATCH  /admin/orders/:id/status
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('orders')
  getAllOrders(@Query() pagination: PaginationQuery) {
    return this.adminService.getAllOrders(pagination);
  }

  @Get('orders/by-status')
  getOrdersByStatus(
    @Query('status') status: StatusEnum,
    @Query() pagination: PaginationQuery,
  ) {
    return this.adminService.getOrdersByStatus(status, pagination);
  }

  @Get('orders/by-date')
  getOrdersInDateRange(@Query() query: DateRangePaginationQuery) {
    const { from, to, page, limit } = query;
    return this.adminService.getOrdersInDateRange({ from, to }, { page, limit });
  }

  @Get('orders/wilaya-stats')
  getWilayaOrderStats() {
    return this.adminService.getWilayaOrderStats();
  }

  @Get('orders/:id')
  getOrderById(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getOrderById(id);
  }

  @Patch('orders/:id/status')
  updateOrderStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.adminService.updateOrderStatus(id, dto.status);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. PRODUCT MANAGEMENT
  // GET    /admin/products?page=&limit=
  // GET    /admin/products/:id
  // PATCH  /admin/products/:id/toggle
  // DELETE /admin/products/:id        (soft delete)
  // DELETE /admin/products/:id/hard   (permanent)
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('products')
  getAllProducts(@Query() pagination: PaginationQuery) {
    return this.adminService.getAllProducts(pagination);
  }

  @Get('products/:id')
  getProductById(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getProductById(id);
  }

  @Patch('products/:id/toggle')
  toggleProductStatus(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.toggleProductStatus(id);
  }

  @Delete('products/:id')
  @HttpCode(HttpStatus.OK)
  deleteProduct(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.deleteProduct(id);
  }

  @Delete('products/:id/hard')
  @HttpCode(HttpStatus.OK)
  hardDeleteProduct(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.hardDeleteProduct(id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. THEME MANAGEMENT
  // GET    /admin/themes?page=&limit=
  // GET    /admin/themes/:id
  // GET    /admin/themes/:id/purchases?page=&limit=
  // POST   /admin/themes
  // PUT    /admin/themes/:id
  // PATCH  /admin/themes/:id/toggle
  // DELETE /admin/themes/:id
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('themes')
  getAllThemes(@Query() pagination: PaginationQuery) {
    return this.adminService.getAllThemes(pagination);
  }

  @Get('themes/:id')
  getThemeById(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getThemeById(id);
  }

  @Get('themes/:id/purchases')
  getThemePurchases(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() pagination: PaginationQuery,
  ) {
    return this.adminService.getThemePurchases(id, pagination);
  }

  @Post('themes')
  @HttpCode(HttpStatus.CREATED)
  createTheme(@Body() dto: CreateThemeDto) {
    return this.adminService.createTheme(dto);
  }

  @Put('themes/:id')
  updateTheme(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateThemeDto,
  ) {
    return this.adminService.updateTheme(id, dto);
  }

  @Patch('themes/:id/toggle')
  toggleThemeStatus(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.toggleThemeStatus(id);
  }

  @Delete('themes/:id')
  @HttpCode(HttpStatus.OK)
  deleteTheme(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.deleteTheme(id);
  }

  @Get('theme/:id/plans')
  getThemePlanStatus(@Param('id') id: string) {
    return this.adminService.getThemePlanStatus(id);
  }

  @Post('theme/:id/plans')
  assignThemeToPlan(
    @Param('id') themeId: string,
    @Body('planId') planId: string,
  ) {
    return this.adminService.assignThemeToPlan(themeId, planId);
  }

  @Delete('theme/:id/plans/:planId')
  removeThemeFromPlan(
    @Param('id') themeId: string,
    @Param('planId') planId: string,
  ) {
    return this.adminService.removeThemeFromPlan(themeId, planId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. THEME TYPES
  // GET    /admin/theme-types
  // POST   /admin/theme-types
  // PUT    /admin/theme-types/:id
  // DELETE /admin/theme-types/:id
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('theme-types')
  getAllThemeTypes() {
    return this.adminService.getAllThemeTypes();
  }

  @Post('theme-types')
  @HttpCode(HttpStatus.CREATED)
  createThemeType(@Body() dto: CreateThemeTypeDto) {
    return this.adminService.createThemeType(dto.name);
  }

  @Put('theme-types/:id')
  updateThemeType(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateThemeTypeDto,
  ) {
    return this.adminService.updateThemeType(id, dto.name);
  }

  @Delete('theme-types/:id')
  @HttpCode(HttpStatus.OK)
  deleteThemeType(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.deleteThemeType(id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. NICHE MANAGEMENT
  // GET    /admin/niches
  // GET    /admin/niches/:id
  // POST   /admin/niches
  // PUT    /admin/niches/:id
  // DELETE /admin/niches/:id
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('niches')
  getAllNiches() {
    return this.adminService.getAllNiches();
  }

  @Get('niches/:id')
  getNicheById(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getNicheById(id);
  }

  @Post('niches')
  @HttpCode(HttpStatus.CREATED)
  createNiche(@Body() dto: any) {
    return this.adminService.createNiche(dto);
  }

  @Put('niches/:id')
  updateNiche(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: any,
  ) {
    return this.adminService.updateNiche(id, dto);
  }

  @Delete('niches/:id')
  @HttpCode(HttpStatus.OK)
  deleteNiche(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.deleteNiche(id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 8.1 NICHE MANAGEMENT
  // GET    /admin/category-niche/tree
  // GET    /admin/category-niche/:id
  // POST   /admin/category-niche
  // DELETE /admin/category-niche/:id
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('category-niche/tree')
  getTree() {
    return this.adminService.findAllcatNicheTrees();
  }

  @Get('category-niche/:id')
  getOne(@Param('id') id: string) {
    return this.adminService.findcatNicheOneWithChildren(id);
  }

  @Post('category-niche')
  create(@Body() createDto: CreateCategoryNicheDto) {
    return this.adminService.createcatNiche(createDto);
  }

  @Post('category-niche-multi')
  createMulti(@Body() createDto: CreateCategoryNicheDto[]) {
    return this.adminService.createcatNichemulti(createDto);
  }

  @Delete('category-niche/:id')
  delete(@Param('id') id: string) {
    return this.adminService.removecatNiche(id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. LANDING PAGES
  // GET    /admin/landing-pages?page=&limit=
  // DELETE /admin/landing-pages/:id
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('landing-pages')
  getAllLandingPages(@Query() pagination: PaginationQuery) {
    return this.adminService.getAllLandingPages(pagination);
  }

  @Delete('landing-pages/:id')
  @HttpCode(HttpStatus.OK)
  deleteLandingPage(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.deleteLandingPage(id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. IMAGES
  // GET    /admin/images?page=&limit=
  // GET    /admin/images/user/:userId
  // DELETE /admin/images/:id
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('images')
  getAllImages(@Query() pagination: PaginationQuery) {
    return this.adminService.getAllImages(pagination);
  }

  @Get('images/user/:userId')
  getImagesByUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() pagination: PaginationQuery,
  ) {
    return this.adminService.getImagesByUser(userId, pagination);
  }

  @Delete('images/:id')
  @HttpCode(HttpStatus.OK)
  deleteImage(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.deleteImage(id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 11. SHIPPING / WILAYAS
  // GET /admin/wilayas
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('wilayas')
  getAllWilayas() {
    return this.adminService.getAllWilayas();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 12. ANALYTICS
  // GET /admin/analytics/top-returned-phones?limit=10
  // GET /admin/analytics/top-wilayas?limit=10
  // GET /admin/analytics/top-returned-wilayas?limit=10
  // GET /admin/analytics/top-products?limit=10
  // GET /admin/analytics/top-categories?limit=10
  // GET /admin/analytics/top-stores?limit=10
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('analytics/top-returned-phones')
  getTopReturnedPhones(@Query('limit') limit?: number) {
    return this.adminService.getTopReturnedPhones(limit ? +limit : 10);
  }

  @Get('analytics/top-wilayas')
  getTopWilayasWithoutReturns(@Query('limit') limit?: number) {
    return this.adminService.getTopWilayasWithoutReturns(limit ? +limit : 10);
  }

  @Get('analytics/top-returned-wilayas')
  getTopReturnedWilayas(@Query('limit') limit?: number) {
    return this.adminService.getTopReturnedWilayas(limit ? +limit : 10);
  }

  @Get('analytics/top-products')
  getTopProducts(@Query('limit') limit?: number) {
    return this.adminService.getTopProducts(limit ? +limit : 10);
  }

  @Get('analytics/top-categories')
  getTopCategories(@Query('limit') limit?: number) {
    return this.adminService.getTopCategories(limit ? +limit : 10);
  }

  @Get('analytics/top-stores')
  getTopStores(@Query('limit') limit?: number) {
    return this.adminService.getTopStores(limit ? +limit : 10);
  }


  // ═══════════════════════════════════════════════════════════════════════════
  // 11. contact
  // GET /admin/contact
  // post /admin/contact
  // Patch /admin/contact
  // ═══════════════════════════════════════════════════════════════════════════


  @Post('contact')
  createMessage(@Body() dto: CreateMessageAdminDto) {
    return this.adminService.createMessage(dto)
  }

  @Get('contact')
  getAllMessage(
    @Query('page') page: string = '1',
    @Query('search') search?: string,  // 👈 غيرنا 'query' إلى 'search' لتطابق الفرونت إند
    @Query('tab') tab: string = 'all', // 👈 أضفنا الـ tab لكي لا يضيع الفلتر
  ) {
    const pageNumber = parseInt(page, 10) || 1;

    // 👈 تأكد من تمرير الثلاثة متغيرات للـ Service
    return this.adminService.getAllMessage(pageNumber, search, tab);
  }

  @Get('count')
  async getCounts(
    @Query('search') search?: string,
    @Query('tab') tab: string = 'all',
  ) {
    return await this.adminService.getCountMessage(search, tab);
  }

  @Patch('contact/:id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: 'replied' | 'archived'
  ) {
    return await this.adminService.updateStatus(id, status);
  }
}