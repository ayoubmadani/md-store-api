import { IsOptional, IsString, IsNotEmpty, MaxLength, IsUUID, ValidateIf, Matches } from "class-validator";

export class CreateShippingProfileDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(80)
    name: string;

    // نسخ الأسعار من هذا الحساب (الافتراضي إن لم يُحدَّد)
    @IsOptional()
    @IsUUID()
    copyFromId?: string;

    // دولة الحساب (ISO alpha-2) — الجزائر افتراضياً
    @IsOptional()
    @Matches(/^[A-Z]{2}$/, { message: 'رمز الدولة: حرفان كبيران (مثل DZ)' })
    country?: string;
}

export class RenameShippingProfileDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(80)
    name: string;
}

export class SetStoreShippingProfileDto {
    @IsUUID()
    storeId: string;

    // null = الحساب الافتراضي
    @ValidateIf((_, v) => v !== null && v !== undefined)
    @IsUUID()
    profileId?: string | null;
}
