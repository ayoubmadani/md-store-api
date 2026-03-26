import { IsString, IsNotEmpty, IsUUID, Matches, IsBoolean, IsOptional } from 'class-validator';

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
}