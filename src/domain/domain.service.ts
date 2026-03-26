import { Injectable, InternalServerErrorException, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';

import { CreateDomainDto } from './dto/create-domain.dto';
import { Domain } from './entities/domain.entity';
import { Store } from '../store/entities/store.entity';

@Injectable()
export class DomainService {
  private readonly logger = new Logger(DomainService.name);

  constructor(
    @InjectRepository(Domain) private readonly domainRepo: Repository<Domain>,
    @InjectRepository(Store) private readonly storeRepo: Repository<Store>,
    private readonly configService: ConfigService,
  ) { }

  async create(dto: CreateDomainDto) {
    // 1. التحقق من وجود المتجر أولاً
    const store = await this.storeRepo.findOne({ where: { id: dto.storeId } });
    if (!store) {
      throw new NotFoundException(`المتجر رقم ${dto.storeId} غير موجود`);
    }

    // 2. التحقق من عدم تكرار الدومين
    const existing = await this.domainRepo.findOne({ where: { domain: dto.domain } });
    if (existing) {
      throw new BadRequestException('هذا الدومين مسجل مسبقاً في النظام');
    }

    // 3. طلب تفعيل SSL من Cloudflare أولاً (أو العكس حسب منطق العمل)
    // نفضل الطلب الخارجي أولاً أو وضعه داخل Transaction
    const cfData = await this.registerWithCloudflare(dto.domain);

    // 4. حفظ في قاعدة البيانات
    const newDomain = this.domainRepo.create({
      domain: dto.domain,
      storeId: dto.storeId,
      isActive: dto.isActive || false,
      cloudflareId: cfData.result.id, // نصيحة: احفظ معرف Cloudflare للعمليات المستقبلية
    });

    return await this.domainRepo.save(newDomain);
  }

  private async registerWithCloudflare(hostname: string) {
    const zoneId = this.configService.get<string>('CLOUDFLARE_ZONE_ID');
    const apiToken = this.configService.get<string>('CLOUDFLARE_API_TOKEN');

    try {
      const response = await axios.post(
        `https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames`,
        {
          hostname: hostname,
          ssl: {
            method: 'http',
            type: 'dv',
            settings: { min_tls_version: '1.2' },
          },
        },
        {
          headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Cloudflare API Error: ${error.response?.data?.errors?.[0]?.message || error.message}`);

      // إذا كان الدومين موجوداً بالفعل في Cloudflare، لا نريد تعطيل العملية
      if (error.response?.data?.errors?.[0]?.code === 1406) {
        return { result: { id: 'already_exists' } };
      }

      throw new InternalServerErrorException('فشل الاتصال بمزود الخدمة السحابي لتأمين الدومين');
    }
  }

  async getStatusFromCloudflare(hostname: string) {
    const zoneId = this.configService.get<string>('CLOUDFLARE_ZONE_ID');
    const apiToken = this.configService.get<string>('CLOUDFLARE_API_TOKEN');

    try {
      const { data } = await axios.get(
        `https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames?hostname=${hostname}`,
        {
          headers: { Authorization: `Bearer ${apiToken}` },
        },
      );

      if (data.result && data.result.length > 0) {
        const result = data.result[0];
        return {
          status: result.status,
          sslStatus: result.ssl.status,
          validationMethod: result.ssl.method,
          // إرجاع سجلات الـ CNAME المطلوبة للتحقق إذا كانت الحالة pending
          ownershipVerification: result.ownership_verification,
          sslValidationRecords: result.ssl.validation_records
        };
      }
      throw new NotFoundException('الدومين غير موجود في Cloudflare');
    } catch (error) {
      this.logger.error(`Fetch Status Error: ${error.message}`);
      throw new InternalServerErrorException('تعذر جلب بيانات الحالة حالياً');
    }
  }

  async findAllWithStore(storeId: string) {
    return await this.domainRepo.find({ where: { storeId } });
  }

  async remove(id: string) {
    // 1. البحث عن الدومين في قاعدة البيانات
    const domainRecord = await this.domainRepo.findOne({ where: { id } });
    if (!domainRecord) {
      throw new NotFoundException('الدومين غير موجود في قاعدة البيانات');
    }

    // 2. حذف الدومين من Cloudflare أولاً
    await this.deleteFromCloudflare(domainRecord.domain);

    // 3. الحذف من قاعدة البيانات بعد التأكد من نجاح الخطوة السابقة (أو تجاوزها حسب منطقك)
    return await this.domainRepo.remove(domainRecord);
  }

  private async deleteFromCloudflare(hostname: string) {
    const zoneId = this.configService.get<string>('CLOUDFLARE_ZONE_ID');
    const apiToken = this.configService.get<string>('CLOUDFLARE_API_TOKEN');

    try {
      // أ- نحتاج أولاً لمعرف الـ Custom Hostname (ID) المرتبط بهذا النطاق
      const { data: searchData } = await axios.get(
        `https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames?hostname=${hostname}`,
        { headers: { Authorization: `Bearer ${apiToken}` } },
      );

      const cfHostnameId = searchData.result?.[0]?.id;

      if (!cfHostnameId) {
        this.logger.warn(`الدومين ${hostname} غير موجود في Cloudflare، سيتم حذفه من القاعدة فقط.`);
        return;
      }

      // ب- إرسال طلب الحذف الفعلي
      await axios.delete(
        `https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames/${cfHostnameId}`,
        { headers: { Authorization: `Bearer ${apiToken}` } },
      );

      this.logger.log(`تم حذف الدومين ${hostname} بنجاح من Cloudflare.`);
    } catch (error) {
      this.logger.error(`فشل حذف الدومين من Cloudflare: ${error.message}`);
      // قرر هنا: هل تريد إيقاف الحذف من قاعدة بياناتك إذا فشل Cloudflare؟
      // عادةً نكتفي بتسجيل الخطأ (Log) ونستمر في الحذف محلياً لتجنب تعليق الطلب.
      throw new InternalServerErrorException('حدث خطأ أثناء محاولة إزالة الدومين من المزود الخارجي');
    }
  }
}