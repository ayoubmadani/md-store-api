import { IsOptional, IsString, IsUUID } from "class-validator";

export class AddShowDto {
    @IsOptional()
    @IsString()
    productId?: string;

    @IsOptional()
    @IsString()
    storeId?: string;

    @IsOptional()
    @IsString()
    visitorId: string;

    @IsUUID()
    @IsOptional()
    lpId?: string
}