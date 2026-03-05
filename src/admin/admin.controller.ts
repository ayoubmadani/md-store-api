import { Controller, UseGuards } from "@nestjs/common";
import { AdminGuard } from "./guard/admin.guard";


@Controller('adimn')
@UseGuards(AdminGuard)
export class AdminController{
    
}