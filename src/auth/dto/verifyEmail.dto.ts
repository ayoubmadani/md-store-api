import { Type } from "class-transformer";
import { IsEmail, IsEnum, IsNumber, IsString } from "class-validator";


export class VerifyEmailDto{
    @IsEmail()
    email:string;

    @IsNumber()
    @Type(() => Number)
    otp:number;
    
}