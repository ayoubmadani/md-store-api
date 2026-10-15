import { Transform, Type } from 'class-transformer';
import { ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsISO8601, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { ALL_PERMISSIONS } from '../permissions';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
// order.manage يضيف order.view تلقائياً (الأسماء غير المعروفة تبقى ليرفضها IsIn)
const perms = ({ value }: { value: unknown }) => {
  if (!Array.isArray(value)) return value;
  const list = [...new Set(value.map(String))];
  if (list.includes('order.manage') && !list.includes('order.view')) list.push('order.view');
  return list;
};

export class CreateGroupDto {
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(80)
  name: string;

  @IsArray() @ArrayUnique() @IsIn(ALL_PERMISSIONS, { each: true, message: 'صلاحية غير معروفة' }) @Transform(perms)
  permissions: string[];
}

export class UpdateGroupDto {
  @IsOptional() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(80)
  name?: string;

  @IsOptional() @IsArray() @ArrayUnique() @IsIn(ALL_PERMISSIONS, { each: true, message: 'صلاحية غير معروفة' }) @Transform(perms)
  permissions?: string[];
}

export class ImportGroupDto {
  @IsUUID()
  sourceGroupId: string;

  @IsOptional() @IsBoolean()
  includeMembers?: boolean;
}

export class InviteMemberDto {
  @IsUUID()
  userId: string;

  // اختياري: يمكن إسناده لمجموعة لاحقاً
  @IsOptional() @IsUUID()
  groupId?: string;
}

export class ChangeMemberGroupDto {
  // null = إخراج العضو من مجموعته (يبقى عضواً بلا صلاحيات)
  @ValidateIf((_, v) => v !== null) @IsUUID()
  groupId: string | null;
}

export class SetMemberSuspensionDto {
  @IsBoolean()
  suspended: boolean;
}

export class UserLookupDto {
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(254)
  q: string;
}

export class ActivityQueryDto {
  @IsOptional() @IsUUID()
  userId?: string;

  @IsOptional() @IsIn(['create', 'update', 'delete', 'restore'])
  action?: 'create' | 'update' | 'delete' | 'restore';

  @IsOptional() @IsIn(['product', 'category', 'domain', 'order', 'store', 'theme', 'group', 'member', 'seo'])
  entity?: 'product' | 'category' | 'domain' | 'order' | 'store' | 'theme' | 'group' | 'member' | 'seo';

  @IsOptional() @IsISO8601()
  from?: string;

  @IsOptional() @IsISO8601()
  to?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number;
}

export class RestoreActivityDto {
  @IsOptional() @IsBoolean()
  force?: boolean;
}
