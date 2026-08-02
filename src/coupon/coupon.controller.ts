import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { CouponService } from './coupon.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { ValidateCouponDto } from './dto/validate-coupon.dto';
import { AuthGuard } from '../auth/guard/auth.guard';
import { GetUser } from '../user/decorator/get-user.decorator';

@Controller('coupons')
export class CouponController {
  constructor(private readonly couponService: CouponService) {}

  // ─── Admin CRUD ───────────────────────────────────────────────────────────
  @Post()
  create(@Body() dto: CreateCouponDto) {
    return this.couponService.create(dto);
  }

  @Get()
  findAll(@Query('active') active?: string, @Query('scope') scope?: string) {
    return this.couponService.findAll({
      active: active === undefined ? undefined : active === 'true',
      scope,
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.couponService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCouponDto) {
    return this.couponService.update(id, dto);
  }

  @Patch(':id/toggle')
  toggleStatus(@Param('id', ParseUUIDPipe) id: string) {
    return this.couponService.toggleStatus(id);
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.couponService.remove(id);
    return { message: `Coupon with ID ${id} deleted successfully` };
  }

  // ─── User-facing preview ──────────────────────────────────────────────────
  @Post('validate')
  @UseGuards(AuthGuard)
  validate(@GetUser() user: any, @Body() dto: ValidateCouponDto) {
    const userId = user.id ?? user.sub;
    return this.couponService.previewCoupon(dto.code, userId, dto.scope, dto.basePrice);
  }
}
