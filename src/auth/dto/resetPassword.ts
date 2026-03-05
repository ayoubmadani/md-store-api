import { IsEmail, IsEnum, IsNumber, IsString } from "class-validator";
import { AuthProvider } from "src/user/entities/user.entity";


export class ResetPasswordDto{
    @IsEmail()
    email:string;

    @IsNumber()
    otp:number;

    @IsString()
    password:string;
}