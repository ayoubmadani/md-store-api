import {
    Body,
    Controller,
    ForbiddenException,
    Get,
    HttpCode,
    HttpStatus,
    Post,
    Request,
    UseGuards,
} from '@nestjs/common';
import { SupportService } from './support.service';
import {
    AddSupportUserDto,
    AssignPlanDto,
    GrantThemeDto,
    SupportAssignPlanDto,
    SupportBuyThemeDto,
    SupportTopUpDto,
    TopUpWalletDto,
} from './dto/create-support.dto';
import { AuthGuard } from '../auth/guard/auth.guard';
import { UserRole } from '../user/entities/user.entity';

@Controller('support')
export class SupportController {
    constructor(private readonly supportService: SupportService) {}

    private requireAdmin(req: any) {
        if (req.user?.role !== UserRole.ADMIN) {
            throw new ForbiddenException('Admin access required');
        }
    }

    // ── Admin endpoints ───────────────────────────────────────────────────────

    @Post('theme/grant')
    @HttpCode(HttpStatus.OK)
    grantTheme(@Request() req: any, @Body() dto: GrantThemeDto) {
        this.requireAdmin(req);
        return this.supportService.grantTheme(dto.userId, dto.themeId);
    }

    @Post('wallet/topup')
    @HttpCode(HttpStatus.OK)
    topUpWallet(@Request() req: any, @Body() dto: TopUpWalletDto) {
        this.requireAdmin(req);
        return this.supportService.topUpWallet(dto.userId, dto.amount);
    }

    @Post('plan/assign')
    @HttpCode(HttpStatus.OK)
    assignPlan(@Request() req: any, @Body() dto: AssignPlanDto) {
        this.requireAdmin(req);
        return this.supportService.assignPlan(dto.userId, dto.planId, dto.interval, dto.days);
    }

    // ── Support Agent endpoints ───────────────────────────────────────────────

    @Get('stats')
    @UseGuards(AuthGuard)
    getStats(@Request() req: any) {
        return this.supportService.getStats(req.user.sub);
    }

    @Post('users/add')
    @UseGuards(AuthGuard)
    @HttpCode(HttpStatus.OK)
    addUserToList(@Request() req: any, @Body() dto: AddSupportUserDto) {
        return this.supportService.addUserToList(req.user.sub, dto.userId);
    }

    @Get('users/my')
    @UseGuards(AuthGuard)
    getMyUsers(@Request() req: any) {
        return this.supportService.getMyUsers(req.user.sub);
    }

    @Post('users/topup')
    @UseGuards(AuthGuard)
    @HttpCode(HttpStatus.OK)
    supportTopUp(@Request() req: any, @Body() dto: SupportTopUpDto) {
        return this.supportService.supportTopUpUserWallet(req.user.sub, dto.userId, dto.amount);
    }

    @Post('users/plan')
    @UseGuards(AuthGuard)
    @HttpCode(HttpStatus.OK)
    supportAssignPlan(@Request() req: any, @Body() dto: SupportAssignPlanDto) {
        return this.supportService.supportAssignPlan(req.user.sub, dto.userId, dto.planId, dto.interval, dto.days);
    }

    @Post('users/theme')
    @UseGuards(AuthGuard)
    @HttpCode(HttpStatus.OK)
    supportBuyTheme(@Request() req: any, @Body() dto: SupportBuyThemeDto) {
        return this.supportService.supportBuyThemeForUser(req.user.sub, dto.userId, dto.themeId);
    }
}
