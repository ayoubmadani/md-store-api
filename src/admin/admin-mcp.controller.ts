import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { AdminService } from './admine.service';
import { PlansService } from '../subscription/plan.service';
import { CreateFeaturesDto } from '../subscription/dto/create-plan.dto';
import { PartialType } from '@nestjs/mapped-types';
import { CreateThemeDto } from '../theme/dto/create-theme.dto';
import { SuperAdminApiKeyGuard } from './guard/super-admin-api-key.guard';
import { SuperAdminGuard } from './guard/super-admin.guard';
import { SuperAdminApiKeyService } from './super-admin-api-key.service';
import { SuperAdminAuthService } from './super-admin-auth.service';
import { ThemeCodeService } from './theme-code.service';
import { LocationsAdminService } from './locations-admin.service';

class PinProofDto {
  @IsString()
  @IsNotEmpty()
  challenge_token: string;

  @Matches(/^\d{6}$/, { message: 'رمز PIN يجب أن يكون 6 أرقام' })
  pin: string;
}

class CreateThemeWithPinDto extends PinProofDto {
  @ValidateNested()
  @Type(() => CreateThemeDto)
  theme: CreateThemeDto;
}

class CreateThemeTypeWithPinDto extends PinProofDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;
}

class PublishThemeCodeWithPinDto extends PinProofDto {
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: 'slug غير صالح' })
  slug: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(600 * 1024)
  code: string;
}

class UpdateThemeWithPinDto extends PinProofDto {
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  price?: number;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

class PlanFeaturesPatchDto extends PartialType(CreateFeaturesDto) { }

class UpdatePlanWithPinDto extends PinProofDto {
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  monthlyPrice?: number;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  yearlyPrice?: number;

  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @IsOptional() @ValidateNested() @Type(() => PlanFeaturesPatchDto)
  features?: PlanFeaturesPatchDto;
}

class PlanThemesWithPinDto extends PinProofDto {
  @IsIn(['add', 'remove'])
  action: 'add' | 'remove';

  @IsArray() @ArrayNotEmpty() @ArrayMaxSize(100) @IsUUID('all', { each: true })
  themeIds: string[];
}


/* المواقع (خدمة mdstore-locations) */
class LevelNamesDto {
  @IsString() @IsNotEmpty() @MaxLength(60) ar: string;
  @IsOptional() @IsString() @MaxLength(60) fr?: string;
  @IsOptional() @IsString() @MaxLength(60) en?: string;
}
class CountryLevelsDto {
  @ValidateNested() @Type(() => LevelNamesDto) region: LevelNamesDto;
  @ValidateNested() @Type(() => LevelNamesDto) locality: LevelNamesDto;
}
class UpsertCountryWithPinDto extends PinProofDto {
  @Matches(/^[A-Z]{2}$/, { message: 'رمز الدولة: حرفان كبيران ISO (مثل MA)' }) code: string;
  @IsString() @IsNotEmpty() @MaxLength(80) name: string;
  @IsString() @IsNotEmpty() @MaxLength(80) ar_name: string;
  @IsOptional() @IsString() @MaxLength(80) fr_name?: string;
  @Matches(/^[A-Z]{3}$/, { message: 'العملة: رمز ISO من 3 أحرف (مثل MAD)' }) currency: string;
  @Matches(/^\+\d{1,4}$/, { message: 'مفتاح الهاتف مثل +212' }) phone_prefix: string;
  @IsOptional() @IsString() @MaxLength(120) phone_pattern?: string;
  @ValidateNested() @Type(() => CountryLevelsDto) levels: CountryLevelsDto;
  @IsBoolean() active: boolean;
}
class LocalityDto {
  @IsInt() @Min(1) id: number;
  @IsString() @IsNotEmpty() @MaxLength(120) name: string;
  @IsString() @IsNotEmpty() @MaxLength(120) ar_name: string;
  @IsOptional() @IsString() @MaxLength(20) post_code?: string;
}
class RegionDto {
  @IsInt() @Min(1) id: number;
  @IsOptional() @IsString() @MaxLength(20) code?: string;
  @IsString() @IsNotEmpty() @MaxLength(120) name: string;
  @IsString() @IsNotEmpty() @MaxLength(120) ar_name: string;
  @IsArray() @ArrayNotEmpty() @ArrayMaxSize(2000) @ValidateNested({ each: true }) @Type(() => LocalityDto) localities: LocalityDto[];
}
class SetRegionsWithPinDto extends PinProofDto {
  @IsArray() @ArrayNotEmpty() @ArrayMaxSize(500) @ValidateNested({ each: true }) @Type(() => RegionDto) regions: RegionDto[];
}
class UpsertRegionWithPinDto extends PinProofDto {
  @ValidateNested() @Type(() => RegionDto) region: RegionDto;
}

class CreateAdminKeyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(90)
  expiresInDays?: number;
}

/**
 * أدوات مدير المنصة عبر MCP — بمفتاح mdsa_ فقط، وكل عملية تعديل تطلب PIN جديداً:
 * pin-challenge ← يعطي أسماء الرموز (مثلاً ZZMMHH) ← المدير يعطي الرقم لـ Claude ← العملية.
 */
@Controller('admin-mcp')
@UseGuards(SuperAdminApiKeyGuard)
export class AdminMcpController {
  constructor(
    private readonly keys: SuperAdminApiKeyService,
    private readonly auth: SuperAdminAuthService,
    private readonly themeCode: ThemeCodeService,
    private readonly admin: AdminService,
    private readonly plans: PlansService,
    private readonly locations: LocationsAdminService,
  ) { }

  @Post('pin-challenge')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  challenge(@Req() req: any) {
    return this.auth.pinChallenge(req.superAdmin.id);
  }

  @Get('theme-types')
  themeTypes() {
    return this.keys.listThemeTypes();
  }

  @Post('theme-types')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async createThemeType(@Req() req: any, @Body() dto: CreateThemeTypeWithPinDto) {
    await this.auth.consumePin(req.superAdmin.id, dto.challenge_token, dto.pin);
    return this.keys.createThemeType(dto.name);
  }

  // كود الثيم (TSX ملف واحد) ← فحص + بناء + رفع إلى themes/<slug>.js
  @Post('theme-code')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async publishThemeCode(@Req() req: any, @Body() dto: PublishThemeCodeWithPinDto) {
    await this.auth.consumePin(req.superAdmin.id, dto.challenge_token, dto.pin);
    return this.themeCode.publish(dto.slug, dto.code);
  }

  /* الثيمات والخطط */

  @Get('themes')
  listThemes(@Query('search') search?: string) {
    return this.keys.listThemes(search);
  }

  @Post('themes/:id/update')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async updateTheme(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateThemeWithPinDto) {
    await this.auth.consumePin(req.superAdmin.id, dto.challenge_token, dto.pin);
    return this.keys.updateTheme(id, { price: dto.price, isActive: dto.isActive });
  }

  @Get('plans')
  async listPlans() {
    const plans = await this.plans.findAll(false);
    return plans.map((p: any) => ({
      id: p.id, name: p.name, monthlyPrice: Number(p.monthlyPrice), yearlyPrice: Number(p.yearlyPrice),
      currency: p.currency, isActive: p.isActive, features: p.features,
    }));
  }

  @Post('plans/:id/update')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async updatePlan(@Req() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePlanWithPinDto) {
    await this.auth.consumePin(req.superAdmin.id, dto.challenge_token, dto.pin);
    const { pin: _pin, challenge_token: _token, ...changes } = dto;
    return this.plans.update(id, changes as any);
  }

  // إضافة/إزالة ثيمات من خطة (التجار المشتركون فيها يحصلون عليها أو يفقدونها)
  @Post('plans/:id/themes')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async planThemes(@Req() req: any, @Param('id', ParseUUIDPipe) planId: string, @Body() dto: PlanThemesWithPinDto) {
    await this.auth.consumePin(req.superAdmin.id, dto.challenge_token, dto.pin);
    const results: { themeId: string; ok: boolean; error?: string }[] = [];
    for (const themeId of dto.themeIds) {
      try {
        if (dto.action === 'add') await this.admin.assignThemeToPlan(themeId, planId);
        else await this.admin.removeThemeFromPlan(themeId, planId);
        results.push({ themeId, ok: true });
      } catch (err: any) {
        results.push({ themeId, ok: false, error: err?.message });
      }
    }
    return { planId, action: dto.action, results };
  }

  /* المواقع: الدول ← المناطق ← البلديات (تُقرأ من خدمة mdstore-locations) */

  @Get('locations/countries')
  listCountries() {
    return this.locations.listCountries();
  }

  @Get('locations/countries/:cc/regions')
  listRegions(@Param('cc') cc: string, @Query('regionId') regionId?: string) {
    return this.locations.listRegions(cc, regionId ? Number(regionId) : undefined);
  }

  @Post('locations/countries')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async upsertCountry(@Req() req: any, @Body() dto: UpsertCountryWithPinDto) {
    await this.auth.consumePin(req.superAdmin.id, dto.challenge_token, dto.pin);
    const { pin: _pin, challenge_token: _token, ...meta } = dto;
    return this.locations.upsertCountry(meta as any);
  }

  @Post('locations/countries/:cc/regions')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async setRegions(@Req() req: any, @Param('cc') cc: string, @Body() dto: SetRegionsWithPinDto) {
    await this.auth.consumePin(req.superAdmin.id, dto.challenge_token, dto.pin);
    return this.locations.setRegions(cc, dto.regions as any);
  }

  @Post('locations/countries/:cc/region')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async upsertRegion(@Req() req: any, @Param('cc') cc: string, @Body() dto: UpsertRegionWithPinDto) {
    await this.auth.consumePin(req.superAdmin.id, dto.challenge_token, dto.pin);
    return this.locations.upsertRegion(cc, dto.region as any);
  }

  @Post('themes')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async createTheme(@Req() req: any, @Body() dto: CreateThemeWithPinDto) {
    await this.auth.consumePin(req.superAdmin.id, dto.challenge_token, dto.pin);
    return this.keys.createTheme(dto.theme);
  }
}

// إدارة مفاتيح MCP من لوحة الأدمن (بعد الدخول بـ Google + PIN)
@Controller('admin/mcp-keys')
@UseGuards(SuperAdminGuard)
export class AdminMcpKeysController {
  constructor(private readonly keys: SuperAdminApiKeyService) { }

  @Get()
  list(@Req() req: any) {
    return this.keys.findAll(req.superAdmin.id);
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateAdminKeyDto) {
    return this.keys.create(req.superAdmin.id, dto.name, dto.expiresInDays);
  }

  @Delete(':id')
  revoke(@Req() req: any, @Param('id', ParseUUIDPipe) id: string) {
    return this.keys.revoke(req.superAdmin.id, id);
  }
}
