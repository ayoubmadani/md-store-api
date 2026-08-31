import { IsString, IsNotEmpty, IsUUID, Matches, IsBoolean, IsOptional, IsEnum, ValidateIf } from 'class-validator';
import { DomainScope } from '../entities/domain.entity';

export class CreateDomainDto {
  @IsString()
  @IsNotEmpty({ message: 'اسم الدومين مطلوب' })
  // هذا التعبير المنتظم يتأكد من أن الدومين بصيغة صحيحة (domain.com أو sub.domain.com)
  @Matches(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i, {
    message: 'يرجى إدخال اسم دومين صالح',
  })
  domain: string;

  @IsUUID('4', { message: 'معرف المتجر (storeId) غير صالح' })
  @IsNotEmpty({ message: 'يجب ربط الدومين بمتجر معين' })
  storeId: string;

  @IsBoolean()
  @IsOptional()
  isActive?:boolean

  @IsEnum(['store', 'landing_page'])
  @IsOptional()
  scope?: DomainScope;

  // مطلوب فقط عندما scope = landing_page — يُنشأ الدومين من داخل المحرر
  // مخصصاً حصرياً لتلك الصفحة.
  @ValidateIf((dto) => dto.scope === 'landing_page')
  @IsUUID()
  builderPageId?: string;
}