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
} from '@nestjs/common';
import { StoreService } from './store.service';
import { CreateFullStoreDto } from './dto/create-full-store.dto';
import { UpdateFullStoreDto } from './dto/update-store.dto';
import { GetUser } from '../user/decorator/get-user.decorator';
import { AuthGuard } from '../auth/guard/auth.guard';
import { UpdatePixelDto } from './dto/pixel/update-pixel.dto';
import { CreatePixelDto } from './dto/pixel/create-pixel.dto';

@Controller('stores')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

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
  async createFullStore(@Body() dto: CreateFullStoreDto, @GetUser() user: any) {
    const store = await this.storeService.createFullStore(dto, this.getUserId(user));
    return { success: true, data: store };
  }

  @Get('domain/:subdomain')
  async getStoreByDomain(
      @Param('subdomain') subdomain: string,
      @Query('categoryId') categoryId?:string,
      @Query('search') search?:string,
      @Query('page') page?:string,
  ) {
    console.log("dfddddddddddddddddddddd");
    
    const store = await this.storeService.getStoreByDomain(subdomain,categoryId,search,page);
    return { success: true, data: store };
  }

  @Get('user/me')
  @UseGuards(AuthGuard)
  async getMyStores(@GetUser() user: any) {
    const stores = await this.storeService.getAllStores(this.getUserId(user));
    return { success: true, data: stores };
  }

  @Get(':storeId')
  @UseGuards(AuthGuard)
  async getStore(@Param('storeId') storeId: string, @GetUser() user: any) {
    const store = await this.storeService.getStore(storeId, this.getUserId(user));
    return { success: true, data: store };
  }

  @Patch(':storeId')
  @UseGuards(AuthGuard)
  async updateStore(
    @Param('storeId') storeId: string,
    @Body() dto: UpdateFullStoreDto,
    @GetUser() user: any,
  ) {
    
    const store = await this.storeService.updateFullStore(storeId, dto, this.getUserId(user));
    //return { success: true, data: store };
  }

  @Delete(':storeId')
  @UseGuards(AuthGuard)
  async deleteStore(@Param('storeId') storeId: string, @GetUser() user: any) {
    return this.storeService.deleteStore(storeId, this.getUserId(user));
  }

  @Put(':storeId/toggle-status')
  @UseGuards(AuthGuard)
  async toggleStatus(@Param('storeId') storeId: string, @GetUser() user: any) {
    return this.storeService.toggleStatusWithAuth(storeId, this.getUserId(user));
  }

  // ==================== PIXELS ====================

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