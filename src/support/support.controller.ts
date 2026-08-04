import {
    Body,
    Controller,
    ForbiddenException,
    Get,
    HttpCode,
    HttpStatus,
    Param,
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
    TransferStoreDto,
} from './dto/create-support.dto';
import { AuthGuard } from '../auth/guard/auth.guard';
import { SupportGuard } from './guard/support.guard';
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
    @UseGuards(AuthGuard, SupportGuard)
    getStats(@Request() req: any) {
        return this.supportService.getStats(req.user.sub);
    }

    @Post('users/add')
    @UseGuards(AuthGuard, SupportGuard)
    @HttpCode(HttpStatus.OK)
    addUserToList(@Request() req: any, @Body() dto: AddSupportUserDto) {
        return this.supportService.addUserToList(req.user.sub, dto.userId);
    }

    @Get('users/my')
    @UseGuards(AuthGuard, SupportGuard)
    getMyUsers(@Request() req: any) {
        return this.supportService.getMyUsers(req.user.sub);
    }

    @Get('users/:userId/subscription')
    @UseGuards(AuthGuard, SupportGuard)
    getUserSubscription(@Request() req: any, @Param('userId') userId: string) {
        return this.supportService.getUserCurrentPlan(req.user.sub, userId);
    }

    @Post('users/topup')
    @UseGuards(AuthGuard, SupportGuard)
    @HttpCode(HttpStatus.OK)
    supportTopUp(@Request() req: any, @Body() dto: SupportTopUpDto) {
        return this.supportService.supportTopUpUserWallet(req.user.sub, dto.userId, dto.amount);
    }

    @Post('users/plan')
    @UseGuards(AuthGuard, SupportGuard)
    @HttpCode(HttpStatus.OK)
    supportAssignPlan(@Request() req: any, @Body() dto: SupportAssignPlanDto) {
        return this.supportService.supportAssignPlan(req.user.sub, dto.userId, dto.planId, dto.interval, dto.days, dto.couponCode);
    }

    @Post('users/theme')
    @UseGuards(AuthGuard, SupportGuard)
    @HttpCode(HttpStatus.OK)
    supportBuyTheme(@Request() req: any, @Body() dto: SupportBuyThemeDto) {
        return this.supportService.supportBuyThemeForUser(req.user.sub, dto.userId, dto.themeId, dto.couponCode);
    }

    // ── Store endpoints ───────────────────────────────────────────────────────

    @Get('stores')
    @UseGuards(AuthGuard, SupportGuard)
    getMyStores(@Request() req: any) {
        return this.supportService.getMyStores(req.user.sub);
    }

    @Post('stores/transfer')
    @UseGuards(AuthGuard, SupportGuard)
    @HttpCode(HttpStatus.OK)
    transferStore(@Request() req: any, @Body() dto: TransferStoreDto) {
        return this.supportService.transferStore(req.user.sub, dto.storeId, dto.targetUserId);
    }
}
