import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';
import { Theme } from '../theme/entities/theme.entity';
import { ThemeUser } from '../theme/entities/theme-user.entity';
import { Subscription } from '../subscription/entities/subscription.entity';
import { Plan } from '../subscription/entities/plan.entity';
import { PaymentService } from '../payment/payment.service';
import { TransactionType } from '../payment/entities/transaction.entity';
import { SupportUser } from './entities/support-users.entity';
import { Store } from '../store/entities/store.entity';

@Injectable()
export class SupportService {
    constructor(
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,

        @InjectRepository(Theme)
        private readonly themeRepo: Repository<Theme>,

        @InjectRepository(ThemeUser)
        private readonly themeUserRepo: Repository<ThemeUser>,

        @InjectRepository(Subscription)
        private readonly subRepo: Repository<Subscription>,

        @InjectRepository(Plan)
        private readonly planRepo: Repository<Plan>,

        @InjectRepository(SupportUser)
        private readonly supportUserRepo: Repository<SupportUser>,

        @InjectRepository(Store)
        private readonly storeRepo: Repository<Store>,

        private readonly paymentService: PaymentService,
        private readonly dataSource: DataSource,
    ) {}

    async grantTheme(userId: string, themeId: string) {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) throw new NotFoundException(`User #${userId} not found`);

        const theme = await this.themeRepo.findOne({ where: { id: themeId } });
        if (!theme) throw new NotFoundException(`Theme #${themeId} not found`);

        const existing = await this.themeUserRepo.findOne({ where: { userId, themeId } });
        if (existing) return { success: true, message: 'User already owns this theme' };

        const themeUser = this.themeUserRepo.create({ userId, themeId });
        await this.themeUserRepo.save(themeUser);

        return { success: true, message: `Theme "${theme.name_ar}" granted to user successfully` };
    }

    async topUpWallet(userId: string, amount: number) {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) throw new NotFoundException(`User #${userId} not found`);

        return this.paymentService.handleWalletBalance(userId, amount, 'ADD', TransactionType.TOP_UP);
    }

    async assignPlan(userId: string, planId: string, interval: 'month' | 'year', days?: number) {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) throw new NotFoundException(`User #${userId} not found`);

        const plan = await this.planRepo.findOne({ where: { id: planId, isActive: true } });
        if (!plan) throw new NotFoundException(`Plan #${planId} not found or inactive`);

        await this.subRepo.update({ userId, status: 'active' }, { status: 'expired' });

        const startDate = new Date();
        const endDate = new Date();

        if (days) {
            endDate.setDate(startDate.getDate() + days);
        } else if (interval === 'year') {
            endDate.setFullYear(startDate.getFullYear() + 1);
        } else {
            endDate.setMonth(startDate.getMonth() + 1);
        }

        const newSub = this.subRepo.create({
            userId,
            planId,
            interval,
            status: 'active',
            startDate,
            endDate,
            autoRenew: false,
        });

        await this.subRepo.save(newSub);

        return {
            success: true,
            message: `Plan "${plan.name}" assigned to user successfully`,
            expiresAt: endDate,
        };
    }

    // ── Support Agent Methods ─────────────────────────────────────────────────

    async addUserToList(supportId: string, userId: string) {
        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) throw new NotFoundException(`User #${userId} not found`);

        const existing = await this.supportUserRepo.findOne({ where: { supportId, userId } });
        if (existing) return { success: true, message: 'User already in your list' };

        const record = this.supportUserRepo.create({ supportId, userId });
        await this.supportUserRepo.save(record);

        return { success: true, message: 'User added to your list successfully' };
    }

    async getMyUsers(supportId: string) {
        return this.supportUserRepo.find({
            where: { supportId },
            relations: ['user'],
        });
    }

    async getStats(supportId: string) {
        const [myUsersCount, wallet] = await Promise.all([
            this.supportUserRepo.count({ where: { supportId } }),
            this.paymentService.getBalanceUser(supportId),
        ]);

        const transactions: any[] = wallet?.user?.transactions ?? [];

        const totalSpent = transactions
            .filter(t => t.action === 'payment')
            .reduce((sum, t) => sum + Number(t.amount), 0);

        const totalReceived = transactions
            .filter(t => t.action === 'deposit')
            .reduce((sum, t) => sum + Number(t.amount), 0);

        const recent = [...transactions]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 10);

        return {
            balance: Number(wallet?.balance ?? 0),
            myUsersCount,
            totalSpent: +totalSpent.toFixed(2),
            totalReceived: +totalReceived.toFixed(2),
            recentTransactions: recent,
        };
    }

    private async assertUserInList(supportId: string, userId: string) {
        const link = await this.supportUserRepo.findOne({ where: { supportId, userId } });
        if (!link) throw new ForbiddenException('This user is not in your list');
    }

    async supportTopUpUserWallet(supportId: string, userId: string, amount: number) {
        await this.assertUserInList(supportId, userId);

        await this.dataSource.transaction(async (manager) => {
            await this.paymentService.handleWalletBalance(supportId, amount, 'SUB', TransactionType.TOP_UP, manager);
            await this.paymentService.handleWalletBalance(userId, amount, 'ADD', TransactionType.TOP_UP, manager);
        });

        return { success: true, message: `Topped up ${amount} DZD to user wallet` };
    }

    async supportAssignPlan(
        supportId: string,
        userId: string,
        planId: string,
        interval: 'month' | 'year',
        days?: number,
    ) {
        await this.assertUserInList(supportId, userId);

        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) throw new NotFoundException(`User #${userId} not found`);

        const plan = await this.planRepo.findOne({ where: { id: planId, isActive: true } });
        if (!plan) throw new NotFoundException(`Plan #${planId} not found or inactive`);

        const price = interval === 'year' ? Number(plan.yearlyPrice) : Number(plan.monthlyPrice);

        const startDate = new Date();
        const endDate = new Date();

        if (days) {
            endDate.setDate(startDate.getDate() + days);
        } else if (interval === 'year') {
            endDate.setFullYear(startDate.getFullYear() + 1);
        } else {
            endDate.setMonth(startDate.getMonth() + 1);
        }

        await this.dataSource.transaction(async (manager) => {
            await this.paymentService.handleWalletBalance(supportId, price, 'SUB', TransactionType.PLAN_SUBSCRIPTION, manager);

            await manager.update(Subscription, { userId, status: 'active' }, { status: 'expired' });

            const newSub = manager.create(Subscription, {
                userId,
                planId,
                interval,
                status: 'active',
                startDate,
                endDate,
                autoRenew: false,
            });
            await manager.save(newSub);
        });

        return {
            success: true,
            message: `Plan "${plan.name}" assigned to user successfully`,
            expiresAt: endDate,
            cost: price,
        };
    }

    async supportBuyThemeForUser(supportId: string, userId: string, themeId: string) {
        await this.assertUserInList(supportId, userId);

        const user = await this.userRepo.findOne({ where: { id: userId } });
        if (!user) throw new NotFoundException(`User #${userId} not found`);

        const theme = await this.themeRepo.findOne({ where: { id: themeId, isActive: true } });
        if (!theme) throw new NotFoundException(`Theme #${themeId} not found or inactive`);

        const existing = await this.themeUserRepo.findOne({ where: { userId, themeId } });
        if (existing) throw new BadRequestException('User already owns this theme');

        await this.dataSource.transaction(async (manager) => {
            await this.paymentService.handleWalletBalance(supportId, theme.price, 'SUB', TransactionType.SELL_THEME, manager);

            const themeUser = manager.create(ThemeUser, { userId, themeId });
            await manager.save(themeUser);
        });

        return {
            success: true,
            message: `Theme "${theme.name_ar}" purchased for user successfully`,
            cost: theme.price,
        };
    }

    // ── Store Management ──────────────────────────────────────────────────────

    async getMyStores(supportId: string) {
        return this.storeRepo.find({
            where: { user: { id: supportId } },
            relations: ['niche', 'theme'],
            order: { createdAt: 'DESC' },
        });
    }

    async transferStore(supportId: string, storeId: string, targetUserId: string) {
        const store = await this.storeRepo.findOne({
            where: { id: storeId, user: { id: supportId } },
        });
        if (!store) throw new NotFoundException('Store not found or does not belong to you');

        await this.assertUserInList(supportId, targetUserId);

        const targetUser = await this.userRepo.findOne({ where: { id: targetUserId } });
        if (!targetUser) throw new NotFoundException(`User #${targetUserId} not found`);

        store.user = targetUser;
        await this.storeRepo.save(store);

        return { success: true, message: `Store "${store.name}" transferred to ${targetUser.username}` };
    }
}
