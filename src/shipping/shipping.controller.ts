import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { ShippingService } from "./shipping.service";
import { WilayaDto } from "./dto/wilaya.dto";
import { CommuneDto } from "./dto/commune.dto";
import { DeleteShippingDto } from "./dto/delete-shipping.dto";
import { AddMissingShippingDto } from "./dto/add-missing-shipping.dto";
import { AuthGuard } from "../auth/guard/auth.guard";
import { GetUser } from "../user/decorator/get-user.decorator";


@Controller('shipping')
export class ShippingController {
    constructor(
        private readonly shippingService: ShippingService
    ) { }

    @Post('add-wilayas')
    createWilaya(@Body() wilayas: WilayaDto[]) {
        return this.shippingService.createWilayas(wilayas)
    }

    @Get('wilayas')
    getAllWilayas() {
        return this.shippingService.getAllWilayas()
    }

    @Post('add-communes')
    createCommune(@Body() communes: CommuneDto[]) {
        return this.shippingService.createCommunes(communes)
    }

    @Get('get-communes/:wilayaId')
    getAllCommunesById(@Param('wilayaId') wilayaId: string) {
        return this.shippingService.getAllCommunesById(+wilayaId)
    }

    @Get('create-shipping')
    @UseGuards(AuthGuard)
    createShipping(
        @GetUser() user:any
    ) {
        const userId = user.sub || user.Id
        return this.shippingService.createShipping(userId)
    }

    @Get('get-shipping')
    @UseGuards(AuthGuard)
    getShipping(@GetUser() user: any,) {
        const userId = user.sub || user.Id
        return this.shippingService.getShipping(userId)
    }

    @Get('public/get-shipping/:userId')
    getShippingPublic(@Param('userId') userId:string) {
        
        return this.shippingService.getShippingPublic(userId)
    }


    @Post('update-shipping')
    @UseGuards(AuthGuard)
    updateShippingPrices(
        @GetUser() user: any,
        @Body() dto: any
    ) {
        const userId = user.sub || user.Id
        return this.shippingService.updateShippingPrices(userId, dto)
    }

    @Post('delete-shipping')
    @UseGuards(AuthGuard)
    deleteShippingPrices(
        @GetUser() user: any,
        @Body() dto: DeleteShippingDto
    ) {
        const userId = user.sub || user.Id
        return this.shippingService.deleteShippingPrices(userId, dto.wilayaIds)
    }

    @Post('add-missing-shipping')
    @UseGuards(AuthGuard)
    addMissingWilayas(
        @GetUser() user: any,
        @Body() dto: AddMissingShippingDto
    ) {
        const userId = user.sub || user.Id
        return this.shippingService.addMissingWilayas(userId, dto.wilayaIds)
    }

}