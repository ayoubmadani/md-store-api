import { Module } from "@nestjs/common";
import { ShowServices } from "./show.services";
import { ShowController } from "./show.controller";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Show } from "./entity/show.entity";

@Module({
    providers:[ShowServices],
    controllers:[ShowController],
    imports:[
        TypeOrmModule.forFeature([Show])
    ],
})
export class ShowModule{}
