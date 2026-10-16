import { Module } from "@nestjs/common";
import { ShippingController } from "./shipping.controller";
import { ShippingService } from "./shipping.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Wilaya } from "./entity/wilaya.entity";
import { Commune } from "./entity/commune.entity";
import { ShippingCommuneRule } from "./entity/shipping-commune-rule.entity";
import { Shipping } from "./entity/shipping.entity";
import { ShippingProfile } from "./entity/shipping-profile.entity";
import { Store } from "../store/entities/store.entity";



@Module({
    controllers:[ShippingController],
    providers:[ShippingService],
    exports:[ShippingService],
    imports:[
        TypeOrmModule.forFeature([Wilaya, Commune, Shipping, ShippingProfile, Store, ShippingCommuneRule])
    ],
})
export class ShippingModule{
    
}