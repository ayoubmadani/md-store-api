import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { CreateOrderDto } from "./dto/create-order.dto";
import { UpdateOrderDto } from "./dto/update-order.dto";
import { OrdersService } from "./order.service";
import { StatusEnum } from "./entities/order.entity";
import { AuthGuard } from "../auth/guard/auth.guard";
import { Throttle } from "@nestjs/throttler";

@Controller('orders')
export class OrdersController {
    constructor(private readonly ordersService: OrdersService) {}

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
    @Get(':storeId')
    getAllOrdersByStoreId(
        @Param('storeId') storeId: string,
        @Query('status') status?: StatusEnum,
        @Query('query')  query?:  string,
        @Query('page')   page?:   number,
    ) {
        return this.ordersService.getAllOrdersByStoreId(storeId, status, query, page);
    }

    @Get('count/:storeId')
    getCountPageByStoreId(
        @Param('storeId') storeId: string,
        @Query('status') status?: StatusEnum,
        @Query('query')  query?:  string,
    ) {
        return this.ordersService.getCountPageByStoreId(storeId, status, query);
    }

    @Get('get-one/:orderId')
    getOne(@Param('orderId') orderId: string) {
        return this.ordersService.getOne(orderId);
    }

    @Get('get-count-status/:storeId')
    getCountStatus(@Param('storeId') storeId: string) {
        return this.ordersService.getCountStatus(storeId);
    }

    // ── Update ─────────────────────────────────────────────────────────────────
    @Patch(':orderId')
    @UseGuards(AuthGuard)
    updateInfoUser(
        @Param('orderId') orderId: string,
        @Body() dto: any[],
    ) {
        console.log(orderId);
        
        return this.ordersService.updateInfoUser(orderId, dto);
    }

    // ── Delete ─────────────────────────────────────────────────────────────────
    @Delete(':orderId')
    @UseGuards(AuthGuard)
    delete(@Param('orderId') orderId: string) {
        return this.ordersService.delete(orderId);
    }
}