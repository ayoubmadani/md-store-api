import { Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsDateString, IsEmail, IsEnum, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional,
  IsString, IsUUID, MaxLength, Min, ValidateNested,
} from 'class-validator';
import { StatusEnum, TypeShipEnum } from '../../order/entities/order.entity';
import { ConfirmationCompanyStatus } from '../entities/confirmation-company.entity';
import { ConfirmationAccess } from '../../user/entities/user.entity';

// ── شركة التأكيد ────────────────────────────────────────────────────────────

export class CreateConfirmationCompanyDto {
  @IsString() @IsNotEmpty() @MaxLength(120)
  name: string;

  @IsString() @IsNotEmpty() @MaxLength(20)
  phone: string;

  @IsOptional() @IsString() @MaxLength(2000)
  description?: string;

  @IsOptional() @IsString()
  logo?: string;

  @IsOptional() @IsInt()
  wilayaId?: number;

  @IsNumber() @Min(0)
  commissionPerDelivered: number;
}

export class UpdateConfirmationCompanyDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120)
  name?: string;

  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(20)
  phone?: string;

  @IsOptional() @IsString() @MaxLength(2000)
  description?: string;

  @IsOptional() @IsString()
  logo?: string;

  @IsOptional() @IsInt()
  wilayaId?: number;

  /** يطبَّق على الطلبات المرسلة بعد التعديل فقط */
  @IsOptional() @IsNumber() @Min(0)
  commissionPerDelivered?: number;
}

export class SetCompanyStatusDto {
  @IsEnum(ConfirmationCompanyStatus)
  status: ConfirmationCompanyStatus;
}

export class AddMemberDto {
  @IsEmail()
  email: string;
}

// ── التاجر ──────────────────────────────────────────────────────────────────

export class SendOrdersDto {
  @IsUUID()
  companyId: string;

  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @IsUUID('all', { each: true })
  orderIds: string[];
}

export class RecallOrdersDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(500) @IsUUID('all', { each: true })
  orderIds: string[];
}

// ── المؤكّد ─────────────────────────────────────────────────────────────────

/** الحالات التي يستطيع المؤكّد وضعها — الشحن والتسليم والإرجاع ليست من صلاحياته */
export const AGENT_STATUSES = [
  StatusEnum.CONFIRMED, StatusEnum.CANCELLED, StatusEnum.APPL1, StatusEnum.APPL2, StatusEnum.APPL3, StatusEnum.POSTPONED,
] as const;

export class AgentSetStatusDto {
  @IsIn(AGENT_STATUSES)
  status: (typeof AGENT_STATUSES)[number];

  /** مطلوب مع postponed */
  @IsOptional() @IsDateString()
  postponedUntil?: string;

  @IsOptional() @IsString() @MaxLength(1000)
  note?: string;
}

export class AgentOrderItemDto {
  @IsUUID()
  productId: string;

  @Type(() => Number) @IsInt() @Min(1)
  quantity: number;

  @IsOptional() @IsUUID()
  offerId?: string | null;

  @IsOptional() @IsUUID()
  variantDetailId?: string | null;
}

export class AgentEditOrderDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(120)
  customerName?: string;

  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(20)
  customerPhone?: string;

  @IsOptional() @IsInt()
  customerWilayaId?: number;

  @IsOptional() @IsInt()
  customerCommuneId?: number;

  @IsOptional() @IsEnum(TypeShipEnum)
  typeShip?: TypeShipEnum;

  /** القائمة كاملة — تستبدل منتجات الطلب، والأسعار يحسبها الخادم */
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50)
  @ValidateNested({ each: true }) @Type(() => AgentOrderItemDto)
  items?: AgentOrderItemDto[];
}

export class SetAccessDto {
  @IsIn([ConfirmationAccess.GRANTED, ConfirmationAccess.REVOKED])
  access: ConfirmationAccess.GRANTED | ConfirmationAccess.REVOKED;
}
