import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { UserRole } from "../../user/entities/user.entity";

@Injectable()
export class SupportGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();

        if (request.user?.role !== UserRole.SUPPORT) {
            throw new ForbiddenException('Support access required');
        }

        return true;
    }
}
