import { Injectable, InternalServerErrorException, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { Cron, CronExpression } from '@nestjs/schedule';

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

  // --- إنشاء دومين جديد وربطه بـ Cloudflare ---
  async create(dto: CreateDomainDto) {
    const store = await this.storeRepo.findOne({ where: { id: dto.storeId } });
    if (!store) throw new NotFoundException(`المتجر رقم ${dto.storeId} غير موجود`);

    const existing = await this.domainRepo.findOne({ where: { domain: dto.domain } });
    if (existing) throw new BadRequestException('هذا الدومين مسجل مسبقاً في النظام');

    const cfData = await this.registerWithCloudflare(dto.domain);

    const newDomain = this.domainRepo.create({
      domain: dto.domain,
      storeId: dto.storeId,
      isActive: false,
      cloudflareId: cfData.result?.id || null, 
    });

    return await this.domainRepo.save(newDomain);
  }

  // --- الفحص الدوري: يعمل كل ساعة لتفعيل الدومينات التي جهزها العملاء ---
  @Cron(CronExpression.EVERY_HOUR)
  async handleCron() {
    this.logger.log('بدء عملية الفحص الدوري للدومينات المعلقة...');

    const pendingDomains = await this.domainRepo.find({ where: { isActive: false } });

    if (pendingDomains.length === 0) {
      this.logger.log('لا توجد دومينات معلقة حالياً.');
      return;
    }

    for (const domain of pendingDomains) {
      try {
        // نستخدم المزامنة لتحديث الحالة تلقائياً في قاعدة البيانات
        await this.syncDomainStatus(domain.id);
      } catch (error) {
        this.logger.error(`فشل فحص الدومين ${domain.domain}: ${error.message}`);
      }
    }
    this.logger.log('انتهت عملية الفحص الدوري بنجاح.');
  }

  // --- جلب تعليمات الربط (لإظهارها في الـ Frontend) ---
  async getConnectionInstructions(id: string) {
    const domainRecord = await this.domainRepo.findOne({ 
        where: { id }, 
        relations: ['store'] 
    });
    
    if (!domainRecord) throw new NotFoundException('الدومين غير موجود');
    
    const cfStatus = await this.getStatusFromCloudflare(domainRecord.domain);

    // القيمة التي يوجه العميل الدومين إليها (Target)
    const cnameTarget = `${domainRecord.store.subdomain}.mdstore.top`;

    return {
      domain: domainRecord.domain,
      status: cfStatus.status,
      sslStatus: cfStatus.sslStatus,
      instructions: [
        {
          type: 'CNAME',
          host: '@',
          value: cnameTarget,
          note: 'قم بتوجيه الدومين الرئيسي لهذا العنوان'
        },
        {
          type: 'TXT',
          host: cfStatus.ownershipVerification?.name || '_cf-custom-hostname',
          value: cfStatus.ownershipVerification?.value || 'جاري التحميل...',
          note: 'أضف هذا السجل لتفعيل شهادة الأمان SSL'
        }
      ]
    };
  }

  // --- تحديث حالة الدومين بناءً على بيانات Cloudflare الفورية ---
  async syncDomainStatus(id: string) {
    const domainRecord = await this.domainRepo.findOne({ where: { id } });
    if (!domainRecord) throw new NotFoundException('الدومين غير موجود');

    const cfStatus = await this.getStatusFromCloudflare(domainRecord.domain);

    // التفعيل فقط إذا كان الدومين والـ SSL كلاهما جاهزين
    if (cfStatus.status === 'active' && cfStatus.sslStatus === 'active') {
      await this.domainRepo.update(id, { isActive: true });
      this.logger.log(`تم تفعيل الدومين بنجاح: ${domainRecord.domain}`);
      return { isActive: true, ...cfStatus };
    }

    return { isActive: false, ...cfStatus };
  }

  // --- التعامل مع Cloudflare API ---

  private async registerWithCloudflare(hostname: string) {
    const zoneId = this.configService.get('CLOUDFLARE_ZONE_ID');
    const apiToken = this.configService.get('CLOUDFLARE_API_TOKEN');

    try {
      const response = await axios.post(
        `https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames`,
        {
          hostname,
          ssl: { method: 'http', type: 'dv', settings: { min_tls_version: '1.2' } },
        },
        { headers: { Authorization: `Bearer ${apiToken}` } },
      );
      return response.data;
    } catch (error) {
      if (error.response?.data?.errors?.[0]?.code === 1406) return { result: { id: 'already_exists' } };
      throw new InternalServerErrorException('خطأ في الاتصال بـ Cloudflare');
    }
  }

  async getStatusFromCloudflare(hostname: string) {
    const zoneId = this.configService.get('CLOUDFLARE_ZONE_ID');
    const apiToken = this.configService.get('CLOUDFLARE_API_TOKEN');

    try {
      const { data } = await axios.get(
        `https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames?hostname=${hostname}`,
        { headers: { Authorization: `Bearer ${apiToken}` } },
      );

      if (data.result?.length > 0) {
        const res = data.result[0];
        return {
          status: res.status,
          sslStatus: res.ssl?.status,
          ownershipVerification: res.ownership_verification,
        };
      }
      throw new NotFoundException('الدومين غير موجود في سجلات السحابة');
    } catch (error) {
      throw new InternalServerErrorException('فشل جلب الحالة من Cloudflare');
    }
  }

  // --- حذف الدومين نهائياً ---
  async remove(id: string) {
    const domainRecord = await this.domainRepo.findOne({ where: { id } });
    if (!domainRecord) throw new NotFoundException('الدومين غير موجود');
    await this.deleteFromCloudflare(domainRecord.domain);
    return await this.domainRepo.remove(domainRecord);
  }

  async findAllWithStore(storeId: string) {
    return await this.domainRepo.find({ where: { storeId } });
  }

  private async deleteFromCloudflare(hostname: string) {
    const zoneId = this.configService.get('CLOUDFLARE_ZONE_ID');
    const apiToken = this.configService.get('CLOUDFLARE_API_TOKEN');
    try {
      const { data } = await axios.get(
        `https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames?hostname=${hostname}`,
        { headers: { Authorization: `Bearer ${apiToken}` } },
      );
      const cfId = data.result?.[0]?.id;
      if (cfId) {
        await axios.delete(`https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames/${cfId}`, {
          headers: { Authorization: `Bearer ${apiToken}` },
        });
      }
    } catch (error) {
      this.logger.error(`فشل حذف الدومين من Cloudflare: ${error.message}`);
    }
  }
}