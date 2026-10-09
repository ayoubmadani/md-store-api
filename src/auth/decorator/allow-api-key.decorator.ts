import { SetMetadata } from '@nestjs/common';

export const ALLOW_API_KEY = 'allowApiKey';

// يسمح لـ AuthGuard بقبول مفاتيح API (mdk_...) على هذا المسار. أي مسار
// بدونه يرفض المفتاح حتى لو كان صالحاً — الـ JWT فقط.
export const AllowApiKey = () => SetMetadata(ALLOW_API_KEY, true);
