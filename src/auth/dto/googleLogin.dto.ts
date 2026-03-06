import { IsEmail, IsEnum, IsOptional, IsString } from "class-validator";


export class GoogleLoginDto{
    @IsEmail()
    email:string;
}