import { IsEmail, IsEnum, IsOptional, IsString } from "class-validator";


export class CredentialLoginDto{
    @IsEmail()
    email:string;

    @IsString()
    password:string;
}