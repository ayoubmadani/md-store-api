import { IsEmail, IsString } from "class-validator";

// تصحيح البريد لحساب لم يُفعَّل بعد (خطأ عند التسجيل)
export class ChangeEmailDto {
    @IsEmail()
    email: string;

    @IsString()
    password: string;

    @IsEmail()
    newEmail: string;
}
