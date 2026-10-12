import { SuperAdminGuard } from '../admin/guard/super-admin.guard';
import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ShippingService } from "./shipping.service";
import { WilayaDto } from "./dto/wilaya.dto";
import { CommuneDto } from "./dto/commune.dto";
import { DeleteShippingDto } from "./dto/delete-shipping.dto";
import { AddMissingShippingDto } from "./dto/add-missing-shipping.dto";
import { AuthGuard } from "../auth/guard/auth.guard";
import { GetUser } from "../user/decorator/get-user.decorator";
import { AllowApiKey } from "../auth/decorator/allow-api-key.decorator";
import { CreateShippingProfileDto, RenameShippingProfileDto, SetStoreShippingProfileDto } from "./dto/shipping-profile.dto";


@Controller('shipping')
export class ShippingController {
    constructor(
        private readonly shippingService: ShippingService
    ) { }

    @Post('add-wilayas')
    @UseGuards(SuperAdminGuard)
    createWilaya(@Body() wilayas: WilayaDto[]) {
        return this.shippingService.createWilayas(wilayas)
    }

    @Get('wilayas')
    getAllWilayas() {
        return this.shippingService.getAllWilayas()
    }

    @Post('add-communes')
    @UseGuards(SuperAdminGuard)
    createCommune(@Body() communes: CommuneDto[]) {
        return this.shippingService.createCommunes(communes)
    }

    @Get('get-communes/:wilayaId')
    getAllCommunesById(@Param('wilayaId') wilayaId: string) {
        return this.shippingService.getAllCommunesById(+wilayaId)
    }

    /* حسابات الشحن — profileId اختياري في كل المسارات أدناه (الافتراضي إن لم يُرسل) */

    @Get('profiles')
    @UseGuards(AuthGuard)
    @AllowApiKey()
    listProfiles(@GetUser() user: any) {
        return this.shippingService.listProfiles(user.sub || user.Id)
    }

    @Post('profiles')
    @UseGuards(AuthGuard)
    @AllowApiKey()
    createProfile(@GetUser() user: any, @Body() dto: CreateShippingProfileDto) {
        return this.shippingService.createProfile(user.sub || user.Id, dto.name, dto.copyFromId)
    }

    @Patch('profiles/:id')
    @UseGuards(AuthGuard)
    renameProfile(@GetUser() user: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: RenameShippingProfileDto) {
        return this.shippingService.renameProfile(user.sub || user.Id, id, dto.name)
    }

    @Delete('profiles/:id')
    @UseGuards(AuthGuard)
    deleteProfile(@GetUser() user: any, @Param('id', ParseUUIDPipe) id: string) {
        return this.shippingService.deleteProfile(user.sub || user.Id, id)
    }

    @Post('store-profile')
    @UseGuards(AuthGuard)
    @AllowApiKey()
    setStoreProfile(@GetUser() user: any, @Body() dto: SetStoreShippingProfileDto) {
        return this.shippingService.setStoreProfile(user.sub || user.Id, dto.storeId, dto.profileId ?? null)
    }

    @Get('create-shipping')
    @UseGuards(AuthGuard)
    @AllowApiKey()
    createShipping(@GetUser() user: any, @Query('profileId') profileId?: string) {
        return this.shippingService.createShipping(user.sub || user.Id, [], profileId)
    }

    @Get('get-shipping')
    @UseGuards(AuthGuard)
    @AllowApiKey()
    getShipping(@GetUser() user: any, @Query('profileId') profileId?: string) {
        return this.shippingService.getShipping(user.sub || user.Id, profileId)
    }

    // storeId اختياري: أسعار حساب الشحن الذي اختاره المتجر، وإلا الحساب الافتراضي للتاجر
    @Get('public/get-shipping/:userId')
    getShippingPublic(@Param('userId') userId: string, @Query('storeId') storeId?: string) {
        return this.shippingService.getShippingPublic(userId, storeId)
    }

    @Post('update-shipping')
    @UseGuards(AuthGuard)
    @AllowApiKey()
    updateShippingPrices(@GetUser() user: any, @Body() dto: any, @Query('profileId') profileId?: string) {
        return this.shippingService.updateShippingPrices(user.sub || user.Id, dto, profileId)
    }

    @Post('delete-shipping')
    @UseGuards(AuthGuard)
    deleteShippingPrices(@GetUser() user: any, @Body() dto: DeleteShippingDto, @Query('profileId') profileId?: string) {
        return this.shippingService.deleteShippingPrices(user.sub || user.Id, dto.wilayaIds, profileId)
    }

    @Post('add-missing-shipping')
    @UseGuards(AuthGuard)
    @AllowApiKey()
    addMissingWilayas(@GetUser() user: any, @Body() dto: AddMissingShippingDto, @Query('profileId') profileId?: string) {
        return this.shippingService.addMissingWilayas(user.sub || user.Id, dto.wilayaIds, profileId)
    }

}
