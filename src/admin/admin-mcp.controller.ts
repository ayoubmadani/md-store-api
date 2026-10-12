import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { CreateThemeDto } from '../theme/dto/create-theme.dto';
import { SuperAdminApiKeyGuard } from './guard/super-admin-api-key.guard';
import { SuperAdminGuard } from './guard/super-admin.guard';
import { SuperAdminApiKeyService } from './super-admin-api-key.service';
import { SuperAdminAuthService } from './super-admin-auth.service';

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
