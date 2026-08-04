import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class GrantThemeDto {
    @IsUUID()
    @IsNotEmpty()
    userId: string;

    @IsUUID()
    @IsNotEmpty()
    themeId: string;
}

export class TopUpWalletDto {
    @IsNotEmpty()
    userId: string;

    @IsNumber()
    @Min(1)
    amount: number;
}

export class AssignPlanDto {
    @IsUUID()
    @IsNotEmpty()
    userId: string;

    @IsUUID()
    @IsNotEmpty()
    planId: string;

    @IsIn(['month', 'year'])
    interval: 'month' | 'year';

    @IsOptional()
    @IsNumber()
    @Min(1)
    days?: number;
}

// ── Support Agent DTOs ────────────────────────────────────────────────────────

export class AddSupportUserDto {
    @IsUUID()
    @IsNotEmpty()
    userId: string;
}

export class SupportTopUpDto {
    @IsUUID()
    @IsNotEmpty()
    userId: string;

    @IsNumber()
    @Min(1)
    amount: number;
}

export class SupportAssignPlanDto {
    @IsUUID()
    @IsNotEmpty()
    userId: string;

    @IsUUID()
    @IsNotEmpty()
    planId: string;

    @IsIn(['month', 'year'])
    interval: 'month' | 'year';

    @IsOptional()
    @IsNumber()
    @Min(1)
    days?: number;

    @IsOptional()
    @IsString()
    couponCode?: string;
}

export class SupportBuyThemeDto {
    @IsUUID()
    @IsNotEmpty()
    userId: string;

    @IsUUID()
    @IsNotEmpty()
    themeId: string;

    @IsOptional()
    @IsString()
    couponCode?: string;
}

export class TransferStoreDto {
    @IsUUID()
    @IsNotEmpty()
    storeId: string;

    @IsUUID()
    @IsNotEmpty()
    targetUserId: string;
}
