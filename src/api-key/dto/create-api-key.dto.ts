import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateApiKeyDto {
  @IsString()
  @IsNotEmpty({ message: 'اسم المفتاح مطلوب' })
  @MaxLength(100)
  name: string;

  // مدة الصلاحية بالأيام — الافتراضي 90 يوماً
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  expiresInDays?: number;
}
