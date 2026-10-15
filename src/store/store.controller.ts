import {
  Controller,
  Post,
  Body,
  UseGuards,
  BadRequestException,
  Get,
  Param,
  Patch,
  Delete,
  Put,
  Query,
  NotFoundException,
  Req,
} from '@nestjs/common';
import { StoreService } from './store.service';
import { CreateFullStoreDto } from './dto/create-full-store.dto';
import { UpdateFullStoreDto } from './dto/update-store.dto';
import { GetUser } from '../user/decorator/get-user.decorator';
import { AuthGuard } from '../auth/guard/auth.guard';
import { AllowApiKey } from '../auth/decorator/allow-api-key.decorator';
import { UpdatePixelDto } from './dto/pixel/update-pixel.dto';
import { CreatePixelDto } from './dto/pixel/create-pixel.dto';
import { UpdateStoreSeoDto } from './dto/update-store-seo.dto';
import { IsBoolean } from 'class-validator';

class SetStoreStatusDto {
  @IsBoolean()
  isActive: boolean;
}
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { OwnerOnly, RequirePermission } from '../team/guards/store-access.decorator';
import { ALL_PERMISSIONS, StorePermission } from '../team/permissions';
import { TeamService } from '../team/team.service';
import { LogActivity } from '../team/activity.interceptor';

@Controller('stores')
export class StoreController {
  constructor(private readonly storeService: StoreService, private readonly team: TeamService) { }

  private getUserId(user: any): string {
    const userId = user.id || user.sub;
    if (!userId) {
      throw new BadRequestException('User ID not found in token');
    }
    return userId;
  }

  // ==================== STORES ====================

  @Post('create-full')
  @UseGuards(AuthGuard)
  @AllowApiKey()
  async createFullStore(@Body() dto: CreateFullStoreDto, @GetUser() user: any) {
    const store = await this.storeService.createFullStore(dto, this.getUserId(user));
    return { success: true, data: store };
  }

  @Get('domain/:subdomain')
  async getStoreByDomain(
    @Param('subdomain') subdomain: string,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
  ) {

    const cleanSubdomain = subdomain.toLowerCase().trim();

    // 1. معالجة طلب أيقونة الموقع مباشرة
    if (cleanSubdomain === 'favicon.ico') {
      throw new NotFoundException('Favicon icon is not applicable for API endpoints');
    }

    if (cleanSubdomain.startsWith('ns1.') || cleanSubdomain.startsWith('ns2.')) {
      throw new NotFoundException('Nameservers are not valid store domains');
    }

    const store = await this.storeService.getStoreByDomain(subdomain, categoryId, search, page);
    return { success: true, data: store };
  }

  @Get('user/me')
  @UseGuards(AuthGuard)
  @AllowApiKey()
  async getMyStores(@GetUser() user: any) {
    const userId = this.getUserId(user);
    // متاجره + المتاجر التي هو عضو مقبول فيها (مع صلاحياته وهل يمكن الدخول إليها الآن)
    const [owned, shared] = await Promise.all([this.storeService.getAllStores(userId), this.team.memberStores(userId)]);
    const ownedItems = owned.map((s: any) => ({ ...s, role: 'owner', permissions: ALL_PERMISSIONS, selectable: true, reason: null }));
    // آخر متجر اختاره (يبقى بعد تسجيل الخروج) — فقط إن كان ما يزال في قائمته
    const selectedStoreId = await this.storeService.getLastStoreId(userId);
    const all = [...ownedItems, ...shared];
    return { success: true, data: all, selectedStoreId: all.some((s: any) => s.id === selectedStoreId) ? selectedStoreId : null };
  }

  // حفظ المتجر المختار في اللوحة: المالك أو عضو مقبول له وصول حالياً (الحارس يتحقق)
  @Put(':storeId/select')
  @AllowApiKey()
  @RequirePermission(null)
  async selectStore(@Param('storeId') storeId: string, @Req() req: any) {
    await this.storeService.setLastStoreId(req.storeAccess?.actorId ?? this.getUserId(req.user), storeId);
    return { success: true, storeId };
  }

  @Get(':storeId')
  @RequirePermission(null)
  @AllowApiKey()
  async getStore(@Param('storeId') storeId: string, @GetUser() user: any) {
    const store = await this.storeService.getStore(storeId, this.getUserId(user));
    return { success: true, data: store };
  }

  @Patch(':storeId')
  @RequirePermission(StorePermission.STORE_UPDATE)
  @LogActivity('store', 'update', { store: true })
  @AllowApiKey()
  async updateStore(
    @Param('storeId') storeId: string,
    @Body() dto: UpdateFullStoreDto,
    @GetUser() user: any,
  ) {
    console.log(dto);

    const store = await this.storeService.updateFullStore(storeId, dto, this.getUserId(user));
    //return { success: true, data: store };
  }

  @Delete(':storeId')
  @OwnerOnly()
  async deleteStore(@Param('storeId') storeId: string, @GetUser() user: any) {
    return this.storeService.deleteStore(storeId, this.getUserId(user));
  }

  @Put(':storeId/toggle-status')
  @RequirePermission(StorePermission.STORE_UPDATE)
  @LogActivity('store', 'update', { store: true })
  async toggleStatus(@Param('storeId') storeId: string, @GetUser() user: any) {
    return this.storeService.toggleStatusWithAuth(storeId, this.getUserId(user));
  }

  @Put(':storeId/status')
  @RequirePermission(StorePermission.STORE_UPDATE)
  @LogActivity('store', 'update', { store: true })
  @AllowApiKey()
  async setStatus(@Param('storeId') storeId: string, @Body() dto: SetStoreStatusDto, @GetUser() user: any) {
    return this.storeService.setStatusWithAuth(storeId, this.getUserId(user), dto.isActive);
  }

  // ==================== PIXELS ====================

  // ==================== SEO ====================

  @Get(':id/seo')
  @RequirePermission(StorePermission.SEO_MANAGE, { param: 'id' })
  @AllowApiKey()
  async getSeo(@Param('id') storeId: string, @GetUser() user: any) {
    return this.storeService.getStoreSeo(storeId, this.getUserId(user));
  }

  @Put(':id/seo')
  @RequirePermission(StorePermission.SEO_MANAGE, { param: 'id' })
  @LogActivity('seo', 'update', { param: 'id' })
  @AllowApiKey()
  async updateSeo(@Param('id') storeId: string, @Body() dto: UpdateStoreSeoDto, @GetUser() user: any) {
    return this.storeService.updateStoreSeo(storeId, this.getUserId(user), dto);
  }

  @Post(':id/pixels')
  @UseGuards(AuthGuard)
  async addPixel(@Param('id') storeId: string, @Body() dto: CreatePixelDto, @GetUser() user: any) {
    return this.storeService.addPixel(storeId, dto, this.getUserId(user));
  }

  @Get(':id/pixels')
  @UseGuards(AuthGuard)
  async getStorePixels(@Param('id') storeId: string, @GetUser() user: any) {
    return this.storeService.getStorePixels(storeId, this.getUserId(user));
  }

  @Patch('pixels/:pixelId')
  @UseGuards(AuthGuard)
  async updatePixel(
    @Param('pixelId') pixelId: string,
    @Body() dto: UpdatePixelDto,
    @GetUser() user: any,
  ) {
    return this.storeService.updatePixel(pixelId, dto, this.getUserId(user));
  }

  @Delete('pixels/:pixelId')
  @UseGuards(AuthGuard)
  async deletePixel(@Param('pixelId') pixelId: string, @GetUser() user: any) {
    return this.storeService.deletePixel(pixelId, this.getUserId(user));
  }

  @Patch('pixels/:pixelId/toggle')
  @UseGuards(AuthGuard)
  async togglePixelStatus(@Param('pixelId') pixelId: string, @GetUser() user: any) {
    return this.storeService.togglePixelStatus(pixelId, this.getUserId(user));
  }
}