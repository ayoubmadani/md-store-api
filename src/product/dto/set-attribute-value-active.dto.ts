import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class SetAttributeValueActiveDto {
  @IsString()
  @IsNotEmpty()
  attrName: string; // مثال: "Color"

  @IsString()
  @IsNotEmpty()
  value: string; // مثال: "#FF0000" أو "XL"

  @IsBoolean()
  isActive: boolean;
}
