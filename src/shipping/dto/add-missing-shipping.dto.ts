import { IsInt, IsNumber, IsOptional } from "class-validator";

export class AddMissingShippingDto {
    @IsOptional()
    @IsNumber({}, { each: true })
    @IsInt({ each: true })
    wilayaIds?: number[];
}
