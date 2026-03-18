import { Body, Controller, Post } from "@nestjs/common";
import { ShowServices } from "./show.services";
import { AddShowDto } from "./dto/add-show.dto";

@Controller('shows')
export class ShowController{
    constructor(
        private readonly showServices:ShowServices
    ){}

    @Post()
    addShow(@Body() dto:AddShowDto){
       return this.showServices.addShow(dto)
    }
}
