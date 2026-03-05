import { IsOptional, IsInt, Min, Max, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryProductsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'رقم الصفحة يجب أن يكون رقم صحيح' })
  @Min(1, { message: 'رقم الصفحة يجب أن يكون 1 على الأقل' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'عدد العناصر يجب أن يكون رقم صحيح' })
  @Min(1, { message: 'عدد العناصر يجب أن يكون 1 على الأقل' })
  @Max(100, { message: 'عدد العناصر يجب ألا يتجاوز 100' })
  limit?: number = 20;

  @IsOptional()
  @IsString()
  search?: string; // للبحث في المنتجات

  @IsOptional()
  @IsString()
  sortBy?: 'createdAt' | 'name' | 'price' = 'createdAt';

  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}