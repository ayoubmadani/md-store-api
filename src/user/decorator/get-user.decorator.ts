import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator لاستخراج بيانات المستخدم من الـ request
 * الاستخدام: @GetUser() user: any
 * أو للحصول على حقل معين: @GetUser('id') userId: string
 */
export const GetUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    // إذا تم تحديد حقل معين، إرجاعه
    if (data) {
      return user?.[data];
    }

    // وإلا إرجاع كامل بيانات المستخدم
    return user;
  },
);