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
  private readonly VERCEL_API_URL = 'https://api.vercel.com/v9/projects';

  constructor(
    @InjectRepository(Domain) private readonly domainRepo: Repository<Domain>,
    @InjectRepository(Store) private readonly storeRepo: Repository<Store>,
    private readonly configService: ConfigService,
  ) { }

  // 1. إضافة دومين جديد
  async create(dto: CreateDomainDto) {
    const store = await this.storeRepo.findOne({ where: { id: dto.storeId } });
    if (!store) throw new NotFoundException(`المتجر غير موجود`);

    const existing = await this.domainRepo.findOne({ where: { domain: dto.domain } });
    if (existing) throw new BadRequestException('هذا الدومين مسجل مسبقاً');

    await this.registerWithVercel(dto.domain);

    const newDomain = this.domainRepo.create({
      domain: dto.domain,
      storeId: dto.storeId,
      isActive: false,
    });

    return await this.domainRepo.save(newDomain);
  }

  // 2. الفحص الدوري (تفعيل آلي)
  @Cron(CronExpression.EVERY_HOUR)
  async handleCron() {
    this.logger.log('بدء فحص حالة الدومينات على Vercel...');
    const pendingDomains = await this.domainRepo.find({ where: { isActive: false } });

    for (const domain of pendingDomains) {
      try {
        const status = await this.getVercelDomainStatus(domain.domain);
        if (status.verified && !status.misconfigured) {
          await this.domainRepo.update(domain.id, { isActive: true });
          this.logger.log(`تم تفعيل المتجر بنجاح: ${domain.domain}`);
        }
      } catch (error) {
        this.logger.error(`خطأ في فحص ${domain.domain}: ${error.message}`);
      }
    }
  }

  // 3. تحديث يدوي للحالة (يستدعيه الـ Controller)
  async syncDomainStatus(id: string) {
    const domainRecord = await this.domainRepo.findOne({ where: { id } });
    if (!domainRecord) throw new NotFoundException('الدومين غير موجود');

    const status = await this.getVercelDomainStatus(domainRecord.domain);

    if (status.verified && !status.misconfigured) {
      await this.domainRepo.update(id, { isActive: true });
      return { isActive: true, ...status };
    }

    return { isActive: false, ...status };
  }

  // 4. تعليمات الربط
  async getConnectionInstructions(domain: string) {
    return {
      domain,
      recommendation: "قم بإضافة السجلات التالية في لوحة تحكم الدومين الخاص بك",
      records: [
        { type: 'A', host: '@', value: '76.76.21.21', note: 'IP الخاص بـ Vercel' },
        { type: 'CNAME', host: 'www', value: 'cname.vercel-dns.com' }
      ]
    };
  }

  // 5. جلب حالة الدومين من Vercel (مبنية كـ Public ليراها الـ Controller)
  public async getVercelDomainStatus(domain: string) {
    const projectId = this.configService.get('VERCEL_PROJECT_ID');
    const token = this.configService.get('VERCEL_AUTH_TOKEN');

    try {
      const { data } = await axios.get(
        `${this.VERCEL_API_URL}/${projectId}/domains/${domain}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return {
        verified: data.verified,
        misconfigured: data.misconfigured
      };
    } catch (error) {
      this.logger.error(`Vercel Fetch Error: ${error.message}`);
      return { verified: false, misconfigured: true };
    }
  }

  // 6. ربط الدومين بـ Vercel (Private - تستخدم داخلياً فقط)
  private async registerWithVercel(domain: string) {
    const projectId = this.configService.get('VERCEL_PROJECT_ID');
    const token = this.configService.get('VERCEL_AUTH_TOKEN');

    try {
      await axios.post(
        `${this.VERCEL_API_URL}/${projectId}/domains`,
        { name: domain },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      if (error.response?.data?.error?.code === 'domain_already_in_use') return;
      throw new InternalServerErrorException('فشل ربط الدومين بـ Vercel');
    }
  }

  // 7. حذف الدومين
  async remove(id: string) {
    const domainRecord = await this.domainRepo.findOne({ where: { id } });
    if (!domainRecord) throw new NotFoundException('الدومين غير موجود');

    const projectId = this.configService.get('VERCEL_PROJECT_ID');
    const token = this.configService.get('VERCEL_AUTH_TOKEN');
    
    try {
      await axios.delete(`${this.VERCEL_API_URL}/${projectId}/domains/${domainRecord.domain}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (e) {
      this.logger.warn(`الدومين محذوف مسبقاً من Vercel أو حدث خطأ بسيط`);
    }

    return await this.domainRepo.remove(domainRecord);
  }

  async findAllWithStore(storeId: string) {
    return await this.domainRepo.find({ where: { storeId } });
  }
}