import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { SuperAdmin } from '../entity/super-admin.entity';

// نوعا توكن مدير المنصة (claim `typ`):
// - جلسة (أسبوع): لا تفتح إلا مسار إدخال PIN
// - دخول (30 دقيقة، بعد PIN): تفتح مسارات المنصة
export const SA_SESSION = 'sa_session';
export const SA_ACCESS = 'sa_access';

async function verifySuperAdmin(
  context: ExecutionContext,
  jwt: JwtService,
  config: ConfigService,
  dataSource: DataSource,
  typ: string,
) {
  const request = context.switchToHttp().getRequest();
  const [type, token] = (request.headers?.authorization ?? '').split(' ');
  if (type?.toLowerCase() !== 'bearer' || !token) throw new UnauthorizedException();

  let payload: any;
  try {
    payload = await jwt.verifyAsync(token, { secret: config.get<string>('JWT_SECRET') });
  } catch {
    throw new UnauthorizedException();
  }
  if (payload?.typ !== typ) throw new UnauthorizedException();

  // يُقرأ من قاعدة البيانات في كل طلب: حذف المدير أو تعطيله يسري فوراً
  const admin = await dataSource.getRepository(SuperAdmin).findOne({ where: { id: payload.sub, isActive: true } });
  if (!admin) throw new UnauthorizedException();
  request.superAdmin = admin;
  return true;
}

/** مسارات المنصة: توكن الدخول (بعد PIN) فقط — توكن التاجر مرفوض مهما كان دوره */
@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
  ) { }

  canActivate(context: ExecutionContext) {
    return verifySuperAdmin(context, this.jwt, this.config, this.dataSource, SA_ACCESS);
  }
}

/** مسار إدخال PIN: توكن الجلسة (أسبوع) */
@Injectable()
export class SuperAdminSessionGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
  ) { }

  canActivate(context: ExecutionContext) {
    return verifySuperAdmin(context, this.jwt, this.config, this.dataSource, SA_SESSION);
  }
}
