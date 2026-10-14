import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

// مجلدات مكتبة الصور في لوحة التاجر
export const IMAGE_FOLDERS = ['products', 'category', 'hero', 'logo', 'favicon'] as const;

export class UploadBase64Dto {
  // base64 خام أو data URL (data:image/png;base64,...)
  @IsString()
  @IsNotEmpty()
  @MaxLength(11_000_000)
  data: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  filename?: string;

  @IsOptional()
  @IsIn(IMAGE_FOLDERS)
  folder?: (typeof IMAGE_FOLDERS)[number];
}
