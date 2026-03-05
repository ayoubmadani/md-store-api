import { IsEnum, IsOptional, IsString } from "class-validator";
import { AuthProvider } from "../entities/user.entity";


export class ResetNewPassword{

    @IsString()
    @IsOptional()
    password?:string

    @IsString()
    newPassword:string
}