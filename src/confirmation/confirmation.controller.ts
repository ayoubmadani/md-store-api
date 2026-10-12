import {
  BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guard/auth.guard';
import { SuperAdminGuard } from '../admin/guard/super-admin.guard';
import { GetUser } from '../user/decorator/get-user.decorator';
import { ConfirmationService } from './confirmation.service';
import { ConfirmationAgentService } from './confirmation-agent.service';
import {
  AddMemberDto, AgentEditOrderDto, AutoSendDto, SaveCompanyDto, PauseCompanyDto, SetMerchantBlockedDto, AgentSetStatusDto, CreateConfirmationCompanyDto, RecallOrdersDto, SendOrdersDto,
  SetAccessDto, SetCompanyStatusDto, UpdateConfirmationCompanyDto,
} from './dto/confirmation.dto';
import { ConfirmationCompanyStatus } from './entities/confirmation-company.entity';
import { ConfirmationAccess } from '../user/entities/user.entity';

const userIdOf = (user: any): string => {
  const id = user?.id || user?.sub || user?.userId;
  if (!id) throw new BadRequestException('User ID not found in token');
  return id;
};

/** تطبيق المؤكّد + البحث العام */
@Controller('confirmation')
@UseGuards(AuthGuard)
export class ConfirmationController {
  constructor(
    private readonly confirmation: ConfirmationService,
    private readonly agent: ConfirmationAgentService,
  ) {}

  // ── الحساب والشركة ──
  @Get('me')
  me(@GetUser() user: any) {
    return this.confirmation.me(userIdOf(user));
  }

  @Post('access/request')
  requestAccess(@GetUser() user: any) {
    return this.confirmation.requestAccess(userIdOf(user));
  }

  @Post('companies')
  register(@Body() dto: CreateConfirmationCompanyDto, @GetUser() user: any) {
    return this.confirmation.registerCompany(userIdOf(user), dto);
  }

  @Patch('company')
  updateCompany(@Body() dto: UpdateConfirmationCompanyDto, @GetUser() user: any) {
    return this.confirmation.updateCompany(userIdOf(user), dto);
  }

  // ── مدير الشركة: إيقاف مؤقت، وإيقاف تاجر عن الإرسال ──
  @Patch('company/pause')
  pause(@Body() dto: PauseCompanyDto, @GetUser() user: any) {
    return this.confirmation.setPause(userIdOf(user), dto.paused, dto.until);
  }

  @Get('clients')
  clients(@GetUser() user: any) {
    return this.confirmation.clients(userIdOf(user));
  }

  @Patch('clients/:merchantId')
  setClientBlocked(
    @Param('merchantId', ParseUUIDPipe) merchantId: string,
    @Body() dto: SetMerchantBlockedDto,
    @GetUser() user: any,
  ) {
    return this.confirmation.setMerchantBlocked(userIdOf(user), merchantId, dto.blocked);
  }

  @Get('earnings')
  earnings(@GetUser() user: any) {
    return this.confirmation.earnings(userIdOf(user));
  }

  // ── الفريق (مدير الشركة) ──
  @Get('team')
  team(@GetUser() user: any) {
    return this.confirmation.listTeam(userIdOf(user));
  }

  @Post('team')
  addMember(@Body() dto: AddMemberDto, @GetUser() user: any) {
    return this.confirmation.addMember(userIdOf(user), dto.email);
  }

  @Delete('team/:memberId')
  removeMember(@Param('memberId', ParseUUIDPipe) memberId: string, @GetUser() user: any) {
    return this.confirmation.removeMember(userIdOf(user), memberId);
  }

  // ── القائمة المشتركة ──
  @Get('queue')
  queue(@GetUser() user: any) {
    return this.agent.queueSummary(userIdOf(user));
  }

  @Post('queue/next')
  next(@GetUser() user: any) {
    return this.agent.next(userIdOf(user));
  }

  @Get('history')
  history(@GetUser() user: any) {
    return this.agent.myHistory(userIdOf(user));
  }

  @Get('orders')
  list(
    @GetUser() user: any,
    @Query('tab') tab?: string,
    @Query('search') search?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
  ) {
    return this.agent.list(userIdOf(user), tab, search, page ?? 1);
  }

  @Post('orders/:id/claim')
  claim(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: any) {
    return this.agent.claim(userIdOf(user), id);
  }

  @Get('orders/:id')
  order(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: any) {
    return this.agent.detail(userIdOf(user), id);
  }

  @Patch('orders/:id')
  edit(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AgentEditOrderDto, @GetUser() user: any) {
    return this.agent.edit(userIdOf(user), id, dto);
  }

  @Post('orders/:id/status')
  setStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AgentSetStatusDto, @GetUser() user: any) {
    return this.agent.setStatus(userIdOf(user), id, dto);
  }

  @Post('orders/:id/release')
  release(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: any) {
    return this.agent.release(userIdOf(user), id);
  }

  // ── القائمة العامة للتجار ──
  @Get('directory')
  directory(
    @GetUser() user: any,
    @Query('search') search?: string,
    @Query('wilayaId', new ParseIntPipe({ optional: true })) wilayaId?: number,
    @Query('storeId') storeId?: string,
  ) {
    return this.confirmation.directory(search, wilayaId, storeId, userIdOf(user));
  }

}

/** لوحة التاجر: قائمته من الشركات، وإرسال/سحب الطلبات */
@Controller('stores/:storeId/confirmation')
@UseGuards(AuthGuard)
export class StoreConfirmationController {
  constructor(private readonly confirmation: ConfirmationService) {}

  @Get('saved')
  saved(@Param('storeId', ParseUUIDPipe) storeId: string, @GetUser() user: any) {
    return this.confirmation.savedList(storeId, userIdOf(user));
  }

  // حفظ شركة أو تغيير حساب التوصيل الخاص بها — shippingAccountId إجباري
  @Post('saved/:companyId')
  save(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: SaveCompanyDto,
    @GetUser() user: any,
  ) {
    return this.confirmation.saveCompany(storeId, userIdOf(user), companyId, dto.shippingAccountId);
  }

  @Delete('saved/:companyId')
  unsave(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @GetUser() user: any,
  ) {
    return this.confirmation.unsaveCompany(storeId, userIdOf(user), companyId);
  }

  @Post('send')
  send(@Param('storeId', ParseUUIDPipe) storeId: string, @Body() dto: SendOrdersDto, @GetUser() user: any) {
    return this.confirmation.sendOrders(storeId, userIdOf(user), dto.companyId, dto.orderIds);
  }

  // الإرسال التلقائي لكل طلب جديد إلى شركة من قائمة المتجر
  @Get('auto')
  getAuto(@Param('storeId', ParseUUIDPipe) storeId: string, @GetUser() user: any) {
    return this.confirmation.getAutoSend(storeId, userIdOf(user));
  }

  @Put('auto')
  setAuto(@Param('storeId', ParseUUIDPipe) storeId: string, @Body() dto: AutoSendDto, @GetUser() user: any) {
    return this.confirmation.setAutoSend(storeId, userIdOf(user), dto.enabled, dto.companyId);
  }

  @Post('recall')
  recall(@Param('storeId', ParseUUIDPipe) storeId: string, @Body() dto: RecallOrdersDto, @GetUser() user: any) {
    return this.confirmation.recallOrders(storeId, userIdOf(user), dto.orderIds);
  }

  @Get('orders/:orderId/log')
  log(
    @Param('storeId', ParseUUIDPipe) storeId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @GetUser() user: any,
  ) {
    return this.confirmation.orderLog(storeId, userIdOf(user), orderId);
  }
}

/** مدير المنصة: صلاحيات المؤكّدين وقبول شركات التأكيد */
@Controller('confirmation/admin')
@UseGuards(SuperAdminGuard)
export class ConfirmationAdminController {
  constructor(private readonly confirmation: ConfirmationService) {}

  @Get('access')
  adminAccess(@Query('access') access?: ConfirmationAccess) {
    return this.confirmation.adminAccessList(access);
  }

  @Patch('access/:userId')
  adminSetAccess(@Param('userId', ParseUUIDPipe) target: string, @Body() dto: SetAccessDto) {
    return this.confirmation.adminSetAccess(target, dto.access);
  }

  @Get('companies')
  adminList(@Query('status') status?: ConfirmationCompanyStatus) {
    return this.confirmation.adminList(status);
  }

  @Patch('companies/:id/status')
  adminSetStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetCompanyStatusDto) {
    return this.confirmation.adminSetStatus(id, dto.status);
  }
}
