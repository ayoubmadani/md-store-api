import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { CreateOrderDto } from "./dto/create-order.dto";
import { UpdateOrderDto } from "./dto/update-order.dto";
import { OrdersService } from "./order.service";
import { StatusEnum } from "./entities/order.entity";
import { AuthGuard } from "../auth/guard/auth.guard";
import { Throttle } from "@nestjs/throttler";
import { GetUser } from "../user/decorator/get-user.decorator";
import { StoreService } from "../store/store.service";

const userIdOf = (user: any): string => user.id || user.sub;

// query params أرقام/strings دائماً هنا — نحوّل "true"/"false" فقط، أي شيء
// آخر (بما فيه القيمة المفقودة) يبقى undefined فلا يُطبَّق أي فلتر.
function parseIsDigital(value?: string): boolean | undefined {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return undefined;
}

@Controller('orders')
export class OrdersController {
    constructor(
        private readonly ordersService: OrdersService,
        private readonly storeService: StoreService,
    ) {}

    // ── Create ─────────────────────────────────────────────────────────────────
    @Post()
    @Throttle({ default: { limit: 3, ttl: 60000 } })
    create(@Body() dto: CreateOrderDto | CreateOrderDto[]) {
        return this.ordersService.create(dto);
    }

    @Post('create')
    @Throttle({ default: { limit: 3, ttl: 60000 } })
    create2(@Body() dto: CreateOrderDto | CreateOrderDto[]) {
        return this.ordersService.create(dto);
    }

    // ── Read ───────────────────────────────────────────────────────────────────
    // القراءة للتاجر صاحب المتجر فقط — الطلبات فيها أسماء الزبائن وهواتفهم وعناوينهم
    @Get(':storeId')
    @UseGuards(AuthGuard)
    async getAllOrdersByStoreId(
        @GetUser() user: any,
        @Param('storeId') storeId: string,
        @Query('status') status?: StatusEnum,
        @Query('query')  query?:  string,
        @Query('page')   page?:   number,
        @Query('isDigital') isDigital?: string,
    ) {
        await this.storeService.verifyOwnership(storeId, userIdOf(user));
        return this.ordersService.getAllOrdersByStoreId(storeId, status, query, page, parseIsDigital(isDigital));
    }

    @Get('count/:storeId')
    @UseGuards(AuthGuard)
    async getCountPageByStoreId(
        @GetUser() user: any,
        @Param('storeId') storeId: string,
        @Query('status') status?: StatusEnum,
        @Query('query')  query?:  string,
        @Query('isDigital') isDigital?: string,
    ) {
        await this.storeService.verifyOwnership(storeId, userIdOf(user));
        return this.ordersService.getCountPageByStoreId(storeId, status, query, parseIsDigital(isDigital));
    }

    @Get('get-one/:orderId')
    @UseGuards(AuthGuard)
    async getOne(@Param('orderId') orderId: string, @GetUser() user: any) {
        await this.ordersService.assertOrderOwner(orderId, userIdOf(user));
        return this.ordersService.getOne(orderId);
    }

    @Get('get-count-status/:storeId')
    @UseGuards(AuthGuard)
    async getCountStatus(@Param('storeId') storeId: string, @GetUser() user: any) {
        await this.storeService.verifyOwnership(storeId, userIdOf(user));
        return this.ordersService.getCountStatus(storeId);
    }

    // ── Update ─────────────────────────────────────────────────────────────────
    @Patch(':orderId')
    @UseGuards(AuthGuard)
    async updateInfoUser(
        @Param('orderId') orderId: string,
        @Body() dto: any[],
        @GetUser() user: any,
    ) {
        await this.ordersService.assertOrderOwner(orderId, userIdOf(user));
        return this.ordersService.updateInfoUser(orderId, dto);
    }

    // ── Delete ─────────────────────────────────────────────────────────────────
    @Delete(':orderId')
    @UseGuards(AuthGuard)
    async delete(@Param('orderId') orderId: string, @GetUser() user: any) {
        await this.ordersService.assertOrderOwner(orderId, userIdOf(user));
        return this.ordersService.delete(orderId);
    }
}