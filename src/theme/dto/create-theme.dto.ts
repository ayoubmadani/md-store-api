import { IsString, IsNumber, IsOptional, IsArray, IsUrl, IsEnum } from 'class-validator';

export class CreateThemeDto {
    @IsOptional()
    @IsString()
    name_en?: string;

    @IsOptional()
    @IsString()
    name_ar?: string;

    @IsOptional()
    @IsString()
    name_fr?: string;

    @IsString()
    slug: string;

    @IsNumber()
    price: number;

    @IsOptional()
    @IsString()
    desc_en?: string;

    @IsOptional()
    @IsString()
    desc_ar?: string;

    @IsOptional()
    @IsString()
    desc_fr?: string;

    @IsOptional()
    @IsUrl()
    imageUrl?: string;

    @IsOptional()
    @IsArray()
    tag: any;

    @IsOptional()
    @IsString()
    typeId: string;
}