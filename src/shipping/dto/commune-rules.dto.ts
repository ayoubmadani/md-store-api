import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsBoolean, IsInt, Min, ValidateNested } from "class-validator";

export class CommuneRuleItemDto {
    @IsInt() @Min(1)
    communeId: number;

    @IsBoolean()
    homeEnabled: boolean;

    @IsBoolean()
    officeEnabled: boolean;
}

export class SetCommuneRulesDto {
    @IsArray() @ArrayNotEmpty() @ArrayMaxSize(200)
    @ValidateNested({ each: true }) @Type(() => CommuneRuleItemDto)
    communes: CommuneRuleItemDto[];
}
