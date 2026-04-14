import { Controller, Get, Query } from "@nestjs/common";
import { PublicStoreService } from "./public-store.service";


@Controller('public-store')
export class PublicStoreController{
    constructor(
        private readonly pStore : PublicStoreService
    ){}

    @Get('')
    getProduct(
        @Query('filter') filter : string,
        @Query('page') page : string,
        @Query('category') category : string,
    ){}
}