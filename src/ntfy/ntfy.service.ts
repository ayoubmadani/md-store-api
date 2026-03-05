import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class NtfyService {
    private readonly logger = new Logger(NtfyService.name);
    private readonly baseUrl = 'https://ntfy.sh';

    // تأكد أن هذا الرابط ينتهي بامتداد صورة (png أو jpg) ليعمل كأيقونة
    private readonly defaultIcon = 'https://img.icons8.com/fluency/96/shopping-bag.png';

    constructor(private readonly httpService: HttpService) { }

    async publish(
        topic: string,
        message: string,
        options?: { title?: string; priority?: number; tags?: string[] }
    ) {
        try {
            await firstValueFrom(
                this.httpService.post(`${this.baseUrl}/${topic}`, message, {
                    headers: {
                        'X-Title': options?.title || 'MD Store',
                        // جرب إرسال الاثنين معاً لضمان التوافق
                        'Icon': this.defaultIcon,
                        'X-Icon': this.defaultIcon,
                        'X-Priority': (options?.priority || 3).toString(),
                        'X-Tags': options?.tags?.join(',') || 'package',
                    }
                })
            );

            this.logger.log(`[MD Store] تم إرسال التنبيه بنجاح إلى: ${topic}`);
        } catch (error) {
            this.logger.error(`[MD Store] فشل إرسال التنبيه: ${error.message}`);
        }
    }
}