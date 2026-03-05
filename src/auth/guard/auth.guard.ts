import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    
    // استخراج الـ Authorization header
    const authHeader = request.headers.authorization;
    
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