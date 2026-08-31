import { Injectable, InternalServerErrorException, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';

import { CreateDomainDto } from './dto/create-domain.dto';
import { Domain } from './entities/domain.entity';
import { Store } from '../store/entities/store.entity';
import { BuilderPage } from '../builder-pages/entities/builder-page.entity';

@Injectable()
export class DomainService {
  private readonly logger = new Logger(DomainService.name);
  // أزلنا كلمة projects من الرابط الأساسي لنجعله أكثر مرونة
  private readonly VERCEL_BASE_URL = 'https://api.vercel.com';

  constructor(
    @InjectRepository(Domain) private readonly domainRepo: Repository<Domain>,
    @InjectRepository(Store) private readonly storeRepo: Repository<Store>,
    @InjectRepository(BuilderPage) private readonly builderPageRepo: Repository<BuilderPage>,
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

    let isActive = true
    const domainSplit = cleanDomain.split('.')

    if (domainSplit.length > 3) throw new NotFoundException(`دومين غير مقبول`);

    if (domainSplit.length === 3) {
      if (domainSplit[1] !== "mdstore" || domainSplit[2] !== "top") {
        throw new NotFoundException(`دومين غير مقبول`);
      }

      const getCountDomain = await this.domainRepo.count({ where: { storeId: dto.storeId, isSub: true } })
      if (getCountDomain >= 3) {
        throw new NotFoundException(`لديك الكثير من الدومينات الفرعية`);
      }
    }



    // 2. التحقق من وجود المتجر
    const store = await this.storeRepo.findOne({ where: { id: dto.storeId } });
    if (!store) throw new NotFoundException(`المتجر غير موجود`);

    // 2.ب التحقق أن صفحة المحرر (عند تخصيص الدومين لصفحة هبوط) تعود لنفس المتجر
    if (dto.scope === 'landing_page') {
      const page = await this.builderPageRepo.findOne({ where: { id: dto.builderPageId } });
      if (!page || page.storeId !== dto.storeId) {
        throw new NotFoundException('الصفحة المحددة غير موجودة أو لا تنتمي لهذا المتجر');
      }
    }

    // 3. التحقق من تكرار الدومين (استخدام الاسم النظيف)
    const existing = await this.domainRepo.findOne({ where: { domain: cleanDomain } });
    if (existing) throw new BadRequestException('هذا الدومين مسجل مسبقاً');

    // 4. تسجيل الدومين في Vercel إذا كان خارجياً
    if (!cleanDomain.endsWith('.mdstore.top')) {
      try {
        isActive = false
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
      isActive: isActive,
      isSub: domainSplit.length === 3,
      scope: dto.scope ?? 'store',
      builderPageId: dto.scope === 'landing_page' ? dto.builderPageId : undefined,
    });

    return await this.domainRepo.save(newDomain);
  }


  // 2. الفحص الدوري (تفعيل آلي)

  async handleCron() {
    this.logger.log('بدء فحص حالة الدومينات على Vercel...');

    // ✅ فقط الدومينات الخارجية (ليست mdstore.top) هي التي تحتاج فحص Vercel
    const pendingDomains = await this.domainRepo.find({
      where: { isActive: false, isSub: false }, // isSub: false = دومين خارجي
    });

    if (pendingDomains.length === 0) return;

    // ✅ batch بدل sequential — 5 في وقت واحد بدل واحد واحد
    const BATCH_SIZE = 5;
    for (let i = 0; i < pendingDomains.length; i += BATCH_SIZE) {
      const batch = pendingDomains.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (domain) => {
        try {
          const status = await this.getVercelDomainStatus(domain.domain);
          if (status.verified && !status.misconfigured) {
            await this.domainRepo.update(domain.id, { isActive: true });
            this.logger.log(`تم تفعيل: ${domain.domain}`);
          }
        } catch (error) {
          this.logger.error(`خطأ في فحص ${domain.domain}: ${error.message}`);
        }
      }));
    }
  }


  // 3. تحديث يدوي للحالة (يستدعيه الـ Controller)

  async syncDomainStatus(id: string) {
    const domainRecord = await this.domainRepo.findOne({ where: { id } });
    if (!domainRecord) throw new NotFoundException('الدومين غير موجود');

    const status = await this.getVercelDomainStatus(domainRecord.domain);

    // تحديث مباشرة باستخدام القيمة الجاهزة من الدالة
    await this.domainRepo.update(id, {
      isActive: status.isActive
    });

    return { ...status };
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
    const headers = { Authorization: `Bearer ${token}` };

    try {
      // 1. جلب بيانات الملكية (v9)
      const domainRes = await axios.get(
        `${this.VERCEL_BASE_URL}/v9/projects/${projectId}/domains/${domain}?projectId=${projectId}`,
        { headers }
      );

      // 2. جلب بيانات الإعدادات والـ DNS (v6)
      const configRes = await axios.get(
        `${this.VERCEL_BASE_URL}/v6/domains/${domain}/config?projectId=${projectId}`,
        { headers }
      );

      const isVerified = domainRes.data.verified === true;
      const isMisconfigured = configRes.data.misconfigured === true;

      // الشرط الذهبي: يجب أن يكون Verified وليس Misconfigured
      return {
        verified: isVerified,
        misconfigured: isMisconfigured,
        isActive: isVerified && !isMisconfigured // هذه القيمة التي ستستخدمها لتحديث isActive في قاعدة بياناتك
      };

    } catch (error) {
      this.logger.error(`Vercel Fetch Error for ${domain}: ${error.message}`);
      return { verified: false, misconfigured: true, isActive: false };
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
  async remove(id: string, storeId: string) {
    // 1. التأكد من وجود الدومين أولاً قبل أي عملية أخرى
    const domainRecord = await this.domainRepo.findOne({ where: { id, storeId } });
    if (!domainRecord) {
      throw new NotFoundException('الدومين غير موجود أو لا ينتمي لهذا المتجر');
    }

    const projectId = this.configService.get<string>('TARGET_STORE_ID');
    const token = this.configService.get<string>('MY_SECRET_TOKEN');

    // 3. محاولة الحذف من Vercel
    try {
      await axios.delete(
        `${this.VERCEL_BASE_URL}/v9/projects/${projectId}/domains/${domainRecord.domain}`,
        {
          params: { projectId },
          headers: { Authorization: `Bearer ${token}` }
        }
      );
    } catch (e) {
      // تسجيل الخطأ مع الاحتفاظ بمعلومات كافية للتصحيح
      this.logger.error(`فشل حذف الدومين ${domainRecord.domain} من Vercel: ${e.response?.data?.message || e.message}`);

      // ملاحظة: إذا كنت تريد منع الحذف من قاعدة البيانات عند فشل Vercel، ارفع خطأ هنا
      // throw new InternalServerErrorException('تعذر حذف الدومين من المزود الخارجي');
    }

    // 4. الحذف النهائي من قاعدة البيانات
    return await this.domainRepo.remove(domainRecord);
  }

  async findAllWithStore(storeId: string) {
    return await this.domainRepo.find({ where: { storeId } });
  }

  // 8. تخصيص دومين موجود (أُنشئ من صفحة الدومين العادية) لصفحة هبوط واحدة —
  // يُستدعى من داخل المحرر بعد اختيار الدومين من قائمة دومينات المتجر.
  async assignToBuilderPage(id: string, builderPageId: string, storeId: string) {
    const domainRecord = await this.domainRepo.findOne({ where: { id, storeId } });
    if (!domainRecord) throw new NotFoundException('الدومين غير موجود أو لا ينتمي لهذا المتجر');

    const page = await this.builderPageRepo.findOne({ where: { id: builderPageId } });
    if (!page || page.storeId !== storeId) {
      throw new NotFoundException('الصفحة المحددة غير موجودة أو لا تنتمي لهذا المتجر');
    }

    domainRecord.scope = 'landing_page';
    domainRecord.builderPageId = builderPageId;
    return this.domainRepo.save(domainRecord);
  }

  // 9. فك الربط — يعيد الدومين ليصبح دومين متجر عادي بدل حذفه، فيمكن إعادة
  // استخدامه لاحقاً أو تخصيصه لصفحة أخرى.
  async unassignFromBuilderPage(id: string, storeId: string) {
    const domainRecord = await this.domainRepo.findOne({ where: { id, storeId } });
    if (!domainRecord) throw new NotFoundException('الدومين غير موجود أو لا ينتمي لهذا المتجر');

    // .update() (not .save()) so builderPageId is explicitly NULLed in SQL —
    // an entity property set to `undefined` isn't guaranteed to clear an
    // existing DB value the way a real SQL NULL does.
    await this.domainRepo.update(id, { scope: 'store', builderPageId: null as unknown as undefined });
    return { ...domainRecord, scope: 'store' as const, builderPageId: null };
  }
}