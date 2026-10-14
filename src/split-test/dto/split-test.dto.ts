import { Type } from 'class-transformer';
import {
  ValidateIf,
  ArrayMaxSize, ArrayMinSize, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';

export class SplitVariantDto {
  @IsUUID()
  builderPageId: string;

  // نسبة الزوار (1–100)؛ غائبة = توزيع متساوٍ
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  weight?: number;
}

export class CreateSplitTestDto {
  @IsUUID()
  storeId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  // كل اختبار له دومينه: دومين جديد (promo.mdstore.top أو دومين خاص) أو دومين صفحة هبوط موجود (domainId)
  @ValidateIf((dto) => !dto.domainId)
  @IsString()
  @Matches(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i, { message: 'يرجى إدخال اسم دومين صالح' })
  domain?: string;

  @ValidateNested({ each: true })
  @Type(() => SplitVariantDto)
  @ArrayMinSize(2, { message: 'اختر صفحتين على الأقل' })
  @ArrayMaxSize(3, { message: 'ثلاث صفحات كحد أقصى' })
  variants: SplitVariantDto[];

  // دومين صفحة هبوط موجود يتحول للاختبار (نفس رابط الإعلانات يبقى)
  @IsOptional()
  @IsUUID()
  domainId?: string;
}

export class UpdateSplitTestDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => SplitVariantDto)
  @ArrayMinSize(2)
  @ArrayMaxSize(3)
  variants?: SplitVariantDto[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SetWinnerDto {
  @IsUUID()
  builderPageId: string;
}
