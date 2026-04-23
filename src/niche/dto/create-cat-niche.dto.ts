import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateCategoryNicheDto {
    
    @IsString()
    @IsNotEmpty({ message: 'الاسم بالإنجليزية مطلوب' })
    name_en: string;

    @IsString()
    @IsNotEmpty({ message: 'الاسم بالعربية مطلوب' })
    name_ar: string;

    @IsString()
    @IsNotEmpty({ message: 'الاسم بالفرنسية مطلوب' })
    name_fr: string;

    @IsUUID()
    @IsNotEmpty({ message: 'يجب تحديد الـ Niche الأساسية' })
    nicheId: string;

    @IsString()
    @IsOptional()
    imageUrl?: string;

    @IsUUID()
    @IsOptional()
    parentId?: string; // في حال كانت هذه الفئة فرعية داخل الشجرة
}