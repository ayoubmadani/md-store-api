import { IsNotEmpty, IsNumber, IsString } from "class-validator";

export class WilayaDto{
    @IsNumber()
    @IsNotEmpty()
    id:number;

    @IsString()
    @IsNotEmpty()
    name:string


    @IsString()
    @IsNotEmpty()
    ar_name:string

}