import {
  IsString, IsNotEmpty, MaxLength, IsEnum, IsNumber, Min, Max,
  IsOptional, IsInt, IsDateString, IsBoolean, ValidateIf,
} from 'class-validator';
import { CouponDiscountType, CouponScope } from '../entities/coupon.entity';

export class CreateCouponDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @IsEnum(CouponDiscountType)
  discountType: CouponDiscountType;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @ValidateIf(o => o.discountType === CouponDiscountType.PERCENTAGE)
  @Max(100)
  discountValue: number;

  @IsEnum(CouponScope)
  scope: CouponScope;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsesPlan?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsesPerUserPlan?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsesTheme?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsesPerUserTheme?: number | null;

  @IsOptional()
  @IsDateString()
  startsAt?: string | null;

  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;
}
