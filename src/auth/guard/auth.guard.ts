import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { API_KEY_PREFIX, ApiKeyService } from '../../api-key/api-key.service';
import { ALLOW_API_KEY } from '../decorator/allow-api-key.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
    private readonly apiKeyService: ApiKeyService,
  ) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // استخراج الـ Authorization header
    const authHeader = (request as any).headers?.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Authorization header is missing');
    }

    const [type, token] = authHeader.split(' ');

    // التحقق من نوع التوكن
    if (type?.toLowerCase() !== 'bearer') {
      throw new BadRequestException('Invalid authorization type. Expected Bearer token');
    }

    if (!token) {
      throw new UnauthorizedException('Token is missing');
    }

    // مفتاح API (mdk_...) — مقبول فقط على المسارات التي عليها @AllowApiKey
    if (token.startsWith(API_KEY_PREFIX)) {
      const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_API_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (!allowed) {
        throw new ForbiddenException('API keys are not allowed on this route');
      }

      request['user'] = await this.apiKeyService.verify(token);
      return true;
    }

    try {
      // التحقق من صحة التوكن
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.config.get<string>('JWT_SECRET'),
      });

      // إضافة بيانات المستخدم إلى الـ request
      request['user'] = payload;

      return true;
    } catch (error) {
      // معالجة أنواع مختلفة من أخطاء JWT
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Token has expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Invalid token');
      }

      throw new UnauthorizedException('Authentication failed');
    }
  }
}