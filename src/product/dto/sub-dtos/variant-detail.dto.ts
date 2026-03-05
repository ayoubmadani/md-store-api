import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsString,
  IsIn,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

// ─── One attribute slot inside a combination ────────────────────────────────
export class VariantAttributeEntryDto {
  @IsOptional()
  @IsString()
  attrId?: string; // front-end temp id like "att-1234" – stored as-is, not a DB key

  @IsString()
  @IsNotEmpty({ message: 'اسم الخاصية مطلوب' })
  attrName: string;

  @IsIn(['color', 'image', 'text'], {
    message: 'displayMode يجب أن يكون color أو image أو text',
  })
  displayMode: 'color' | 'image' | 'text';

  @IsString()
  @IsNotEmpty({ message: 'قيمة الخاصية مطلوبة' })
  value: string; // hex color | image URL | plain text (e.g. "XL")
}

// ─── The main DTO ────────────────────────────────────────────────────────────
export class VariantDetailDto {
  // ✅ removed: id – front-end sends "vd-1234" which is not a valid UUID.
  //    Postgres auto-generates the UUID; service already strips non-UUID ids.

  /**
   * Each entry describes one attribute of this combination.
   *
   * Example payload:
   * [
   *   { attrId: "att-1",  attrName: "Color", displayMode: "color", value: "#FF0000" },
   *   { attrId: "att-2",  attrName: "Size",  displayMode: "text",  value: "XL" }
   * ]
   *
   * Stored as JSON in the VariantDetail.name column.
   */
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantAttributeEntryDto)
  attributes: VariantAttributeEntryDto[];

  /**
   * Price – front-end sometimes sends it as a string ("1200"), so we coerce
   * to number before validation.
   */
  @Transform(({ value }) => (value !== undefined && value !== '' ? Number(value) : value))
  @IsNumber({}, { message: 'سعر المتغير يجب أن يكون رقماً' })
  @Min(0, { message: 'السعر يجب أن يكون موجباً' })
  price: number;

  /**
   * Stock – same string/number coercion as price.
   */
  @IsOptional()
  @Transform(({ value }) => (value !== undefined && value !== '' ? Number(value) : 0))
  @IsNumber({}, { message: 'المخزون يجب أن يكون رقماً' })
  @Min(0)
  stock?: number;

  @IsOptional()
  @Transform(({ value }) => {
    // handle the case where front-end sends "true"/"false" as strings
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  autoGenerate?: boolean;
}