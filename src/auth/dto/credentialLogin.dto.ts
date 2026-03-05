import { IsEmail, IsEnum, IsOptional, IsString } from "class-validator";
import { AuthProvider } from "src/user/entities/user.entity";


export class CredentialLoginDto{
    @IsEmail()
    email:string;

    @IsString()
    password:string;
}