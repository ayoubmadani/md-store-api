import { IsEmail, IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';

export class CreateMessageAdminDto {
    @IsString()
    @IsNotEmpty({ message: 'اسم المستخدم مطلوب' })
    @MinLength(3, { message: 'اسم المستخدم يجب أن لا يقل عن 3 أحرف' })
    username: string;

    @IsEmail({}, { message: 'يرجى إدخال بريد إلكتروني صحيح' })
    @IsNotEmpty({ message: 'البريد الإلكتروني مطلوب' })
    email: string;

    @IsString()
    @IsNotEmpty({ message: 'موضوع الرسالة مطلوب' })
    @MaxLength(100, { message: 'الموضوع طويل جداً' })
    subject: string;

    @IsString()
    @IsNotEmpty({ message: 'محتوى الرسالة مطلوب' })
    @MinLength(10, { message: 'يجب أن تحتوي الرسالة على 10 أحرف على الأقل' })
    message: string;
}