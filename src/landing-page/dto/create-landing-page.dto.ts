import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateLandingPageDto {
    @IsString()
    @IsOptional()
    paltform: string; // أو platform

    @IsUUID() // إذا كان الـ productId عبارة عن UUID
    @IsNotEmpty()
    productId: string;

    @IsString()
    @IsOptional()
    urlImage: string;

    @IsString()
    @IsOptional()
    domain: string;
}