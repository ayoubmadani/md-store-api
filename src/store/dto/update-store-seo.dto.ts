import { IsBoolean, IsOptional, IsString, IsUrl, Matches, MaxLength, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';

// نص فارغ = حذف القيمة (null)
const emptyToNull = ({ value }: { value: unknown }) => (typeof value === 'string' && value.trim() === '' ? null : typeof value === 'string' ? value.trim() : value);

export class UpdateStoreSeoDto {
  @IsOptional() @Transform(emptyToNull) @ValidateIf((_, v) => v !== null)
  @IsString() @MaxLength(70, { message: 'العنوان أطول من 70 حرفاً' })
  metaTitle?: string | null;

  @IsOptional() @Transform(emptyToNull) @ValidateIf((_, v) => v !== null)
  @IsString() @MaxLength(170, { message: 'الوصف أطول من 170 حرفاً' })
  metaDescription?: string | null;

  @IsOptional() @Transform(emptyToNull) @ValidateIf((_, v) => v !== null)
  @IsString() @MaxLength(300, { message: 'الكلمات المفتاحية أطول من 300 حرف' })
  keywords?: string | null;

  @IsOptional() @Transform(emptyToNull) @ValidateIf((_, v) => v !== null)
  @IsUrl({ protocols: ['https'], require_protocol: true }, { message: 'رابط صورة المشاركة يجب أن يبدأ بـ https://' }) @MaxLength(500)
  ogImageUrl?: string | null;

  // يقبل الرمز وحده أو الوسم كاملاً <meta ... content="..."> — نحفظ الرمز فقط
  @IsOptional() @Transform(({ value }) => extractToken(value)) @ValidateIf((_, v) => v !== null)
  @IsString() @MaxLength(120) @Matches(/^[A-Za-z0-9_\-]+$/, { message: 'رمز تحقق Google غير صالح' })
  googleVerification?: string | null;

  @IsOptional() @Transform(({ value }) => extractToken(value)) @ValidateIf((_, v) => v !== null)
  @IsString() @MaxLength(120) @Matches(/^[A-Za-z0-9_\-]+$/, { message: 'رمز تحقق Bing غير صالح' })
  bingVerification?: string | null;

  @IsOptional() @IsBoolean()
  allowIndexing?: boolean;
}

function extractToken(value: unknown) {
  if (typeof value !== 'string') return value;
  const v = value.trim();
  if (!v) return null;
  return v.match(/content\s*=\s*["']([^"']+)["']/i)?.[1]?.trim() ?? v;
}
