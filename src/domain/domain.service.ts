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
  // أزلنا كلمة projects من الرابط الأساسي لنجعله أكثر مرونة
  private readonly VERCEL_BASE_URL = 'https://api.vercel.com';

  constructor(
    @InjectRepository(Domain) private readonly domainRepo: Repository<Domain>,
    @InjectRepository(Store) private readonly storeRepo: Repository<Store>,
    private readonly configService: ConfigService,
  ) { }

  // 1. إضافة دومين جديد

  async create(dto: CreateDomainDto) {
    // 1. تنظيف الدومين: إزالة الفراغات، تحويله لأحرف صغيرة، وإزالة www.
    const cleanDomain = dto.domain
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '') // إزالة البروتوكول إن وجد
      .replace(/^www\./, '');      // إزالة www لتوحيد البيانات

    // 2. التحقق من وجود المتجر
    const store = await this.storeRepo.findOne({ where: { id: dto.storeId } });
    if (!store) throw new NotFoundException(`المتجر غير موجود`);

    // 3. التحقق من تكرار الدومين (استخدام الاسم النظيف)
    const existing = await this.domainRepo.findOne({ where: { domain: cleanDomain } });
    if (existing) throw new BadRequestException('هذا الدومين مسجل مسبقاً');

    // 4. تسجيل الدومين في Vercel إذا كان خارجياً
    if (!cleanDomain.endsWith('.mdstore.top')) {
      try {
        await this.registerWithVercel(cleanDomain);
      } catch (error) {
        // تسجيل الخطأ وتنبيه المستخدم بأن الربط التقني فشل
        console.error('Vercel Registration Error:', error);
        throw new BadRequestException('فشل ربط الدومين مع نظام الاستضافة، يرجى التحقق من صحة النطاق');
      }
    }

    // 5. الحفظ في قاعدة البيانات
    const newDomain = this.domainRepo.create({
      domain: cleanDomain,
      storeId: dto.storeId,
      isActive: false, // يبقى غير نشط حتى يتحقق الـ Cron Job أو الفحص اليدوي
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

    // تحديث قاعدة البيانات بناءً على الحالة الفعلية من Vercel
    const isActuallyActive = status.verified && !status.misconfigured;

    await this.domainRepo.update(id, {
      isActive: isActuallyActive
    });

    return { isActive: isActuallyActive, ...status };
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





  // 5. جلب حالة الدومين - تحديث الرابط ليكون صريحاً جداً
  public async getVercelDomainStatus(domain: string) {
    const projectId = this.configService.get('TARGET_STORE_ID');
    const token = this.configService.get('MY_SECRET_TOKEN');

    try {
      const { data } = await axios.get(
        `${this.VERCEL_BASE_URL}/v9/projects/${projectId}/domains/${domain}?projectId=${projectId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return { verified: data.verified, misconfigured: data.misconfigured };
    } catch (error) {
      this.logger.error(`Vercel Fetch Error: ${error.response?.data?.error?.message || error.message}`);
      return { verified: false, misconfigured: true };
    }
  }

  // 6. ربط الدومين - إضافة البراميترات لمنع التداخل
  // مثال لدالة التسجيل (طبق نفس المنطق على البقية)
  private async registerWithVercel(domain: string) {
    const projectId = this.configService.get('TARGET_STORE_ID');
    const token = this.configService.get('MY_SECRET_TOKEN');
    const teamId = this.configService.get('VERCEL_TEAM_ID'); // أضف هذا

    try {
      // نرسل teamId و projectId معاً في الرابط
      await axios.post(
        `https://api.vercel.com/v10/projects/${projectId}/domains?teamId=${teamId}`,
        { name: domain },
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (error) {
      // ...
    }
  }

  // 7. حذف الدومين - تحديث الرابط
  async remove(id: string) {
    const domainRecord = await this.domainRepo.findOne({ where: { id } });
    if (!domainRecord) throw new NotFoundException('الدومين غير موجود');

    const projectId = this.configService.get('TARGET_STORE_ID');
    const token = this.configService.get('MY_SECRET_TOKEN');

    try {
      await axios.delete(
        `${this.VERCEL_BASE_URL}/v9/projects/${projectId}/domains/${domainRecord.domain}?projectId=${projectId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (e) {
      this.logger.warn(`فشل حذف الدومين من Vercel: ${e.message}`);
    }

    return await this.domainRepo.remove(domainRecord);
  }

  async findAllWithStore(storeId: string) {
    return await this.domainRepo.find({ where: { storeId } });
  }
}