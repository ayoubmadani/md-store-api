import { ArrayNotEmpty, IsInt, IsNumber } from "class-validator";

export class DeleteShippingDto {
    @IsNumber({}, { each: true })
    @IsInt({ each: true })
    @ArrayNotEmpty()
    wilayaIds: number[];
}
