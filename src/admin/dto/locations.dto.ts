import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min, ValidateNested } from 'class-validator';

// بيانات خدمة المواقع (mdstore-locations) — مشتركة بين لوحة الأدمن وأدوات MCP
export class LevelNamesDto {
  @IsString() @IsNotEmpty() @MaxLength(60) ar: string;
  @IsOptional() @IsString() @MaxLength(60) fr?: string;
  @IsOptional() @IsString() @MaxLength(60) en?: string;
}
export class CountryLevelsDto {
  @ValidateNested() @Type(() => LevelNamesDto) region: LevelNamesDto;
  @ValidateNested() @Type(() => LevelNamesDto) locality: LevelNamesDto;
}
export class UpsertCountryDto {
  @Matches(/^[A-Z]{2}$/, { message: 'رمز الدولة: حرفان كبيران ISO (مثل MA)' }) code: string;
  @IsString() @IsNotEmpty() @MaxLength(80) name: string;
  @IsString() @IsNotEmpty() @MaxLength(80) ar_name: string;
  @IsOptional() @IsString() @MaxLength(80) fr_name?: string;
  @Matches(/^[A-Z]{3}$/, { message: 'العملة: رمز ISO من 3 أحرف (مثل MAD)' }) currency: string;
  @Matches(/^\+\d{1,4}$/, { message: 'مفتاح الهاتف مثل +212' }) phone_prefix: string;
  @IsOptional() @IsString() @MaxLength(120) phone_pattern?: string;
  @ValidateNested() @Type(() => CountryLevelsDto) levels: CountryLevelsDto;
  @IsBoolean() active: boolean;
}
export class LocalityDto {
  @IsInt() @Min(1) id: number;
  @IsString() @IsNotEmpty() @MaxLength(120) name: string;
  @IsString() @IsNotEmpty() @MaxLength(120) ar_name: string;
  @IsOptional() @IsString() @MaxLength(20) post_code?: string;
}
export class RegionDto {
  @IsInt() @Min(1) id: number;
  @IsOptional() @IsString() @MaxLength(20) code?: string;
  @IsString() @IsNotEmpty() @MaxLength(120) name: string;
  @IsString() @IsNotEmpty() @MaxLength(120) ar_name: string;
  @IsArray() @ArrayNotEmpty() @ArrayMaxSize(2000) @ValidateNested({ each: true }) @Type(() => LocalityDto) localities: LocalityDto[];
}
export class SetRegionsDto {
  @IsArray() @ArrayNotEmpty() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => RegionDto) regions: RegionDto[];
}
export class UpsertRegionDto {
  @ValidateNested() @Type(() => RegionDto) region: RegionDto;
}
