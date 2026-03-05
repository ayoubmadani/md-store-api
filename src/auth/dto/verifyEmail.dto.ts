import { Type } from "class-transformer";
import { IsEmail, IsEnum, IsNumber, IsString } from "class-validator";
import { AuthProvider } from "src/user/entities/user.entity";


export class VerifyEmailDto{
    @IsEmail()
    email:string;

    @IsNumber()
    @Type(() => Number)
    otp:number;
    
}