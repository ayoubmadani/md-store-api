import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { SUPER_ADMIN_KEY_PREFIX, SuperAdminApiKeyService } from '../super-admin-api-key.service';

/** مسارات admin-mcp: مفتاح مدير المنصة (mdsa_...) فقط — مفاتيح التجار وتوكنات JWT مرفوضة */
@Injectable()
export class SuperAdminApiKeyGuard implements CanActivate {
  constructor(private readonly keys: SuperAdminApiKeyService) { }

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const [type, token] = (request.headers?.authorization ?? '').split(' ');
    if (type?.toLowerCase() !== 'bearer' || !token?.startsWith(SUPER_ADMIN_KEY_PREFIX)) {
      throw new UnauthorizedException('Admin key required');
    }
    request.superAdmin = await this.keys.verify(token);
    return true;
  }
}
