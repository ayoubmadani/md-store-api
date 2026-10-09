import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { DataSource } from "typeorm";
import { User, UserRole } from "../../user/entities/user.entity";

/**
 * يُستعمل بعد AuthGuard: يسمح فقط لحساب دوره ADMIN.
 * الدور يُقرأ من قاعدة البيانات لا من التوكن — سحب دور الأدمن يسري فوراً
 * حتى لو كان التوكن القديم ما زال صالحاً.
 */
@Injectable()
export class AdminGuard implements CanActivate {
    constructor(private readonly dataSource: DataSource) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const userId = request.user?.sub || request.user?.id;
        if (!userId) throw new UnauthorizedException();

        const user = await this.dataSource.getRepository(User).findOne({
            where: { id: userId },
            select: ['id', 'role'],
        });
        if (user?.role !== UserRole.ADMIN) throw new ForbiddenException('Admins only');
        return true;
    }
}
