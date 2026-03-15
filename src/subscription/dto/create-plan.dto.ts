import { IsString, IsNumber, IsEnum, IsArray, IsOptional, IsBoolean, IsNotEmpty, MaxLength } from 'class-validator';

export class CreatePlanDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(100)
    name: string;

    @IsNumber({ maxDecimalPlaces: 2 })
    @IsNotEmpty()
    price: number;

    @IsString()
    @IsOptional()
    currency?: string; // سيعتمد القيمة الافتراضية 'DZD' من الـ Entity إذا لم تُرسل

    @IsEnum(['month', 'year'], { message: 'Interval must be either month or year' })
    interval: 'month' | 'year';

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    features?: string[];

    @IsString()
    @IsOptional()
    stripePriceId?: string;

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;
}