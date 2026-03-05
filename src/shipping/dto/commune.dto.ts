import { IsNotEmpty, IsNumber, IsString, IsOptional } from "class-validator";

export class CommuneDto {
    @IsNumber()
    @IsNotEmpty()
    id: number;

    @IsString()
    @IsNotEmpty()
    name: string; // الاسم بالفرنسية/الإنجليزية (e.g., "Aflou")

    @IsString()
    @IsNotEmpty()
    ar_name: string; // الاسم بالعربية (e.g., "أفلو")

    @IsString()
    @IsOptional() // جعلته اختيارياً لأن بعض البلديات قد لا تملك كود بريدي واحد ثابت
    post_code: string;

    @IsNumber() // تصحيح: يجب أن يتوافق مع نوع البيانات أدناه
    @IsNotEmpty()
    wilaya_id: number; // تغيير النوع من string إلى number ليتوافق مع معرفات الولايات (1-69)
}