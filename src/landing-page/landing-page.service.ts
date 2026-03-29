import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LandingPage } from './entities/landing-page.entity';
import { Repository } from 'typeorm';
import { AiService } from '../ai/ai.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { CreateLandingPageDto } from './dto/create-landing-page.dto';
import { UpdateLandingPageDto } from './dto/update-landing-page.dto';

@Injectable()
export class LandingPageService {
  constructor(
    @InjectRepository(LandingPage)
    private readonly landingPageRope: Repository<LandingPage>,
    private readonly aiService: AiService,
    private readonly subscriptionService: SubscriptionService,
  ) { }

  private async getLPLimit(userId: string): Promise<number> {
    const sub = await this.subscriptionService.findSub(userId);
    return sub?.plan?.features?.landingPageNumber ?? 0;
  }

  private async assertLPLimitNotReached(userId: string, extraMessage?: string): Promise<void> {
    const [limit, count] = await Promise.all([
      this.getLPLimit(userId),
      this.landingPageRope.count({ where: { isActive: true, product: { store: { user: { id: userId } } } } }),
    ]);
    if (count >= limit) {
      throw new BadRequestException(extraMessage ?? `لقد وصلت إلى الحد الأقصى لصفحات الهبوط في خطتك (${limit}).`);
    }
  }

  async create(dto: CreateLandingPageDto, userId: string) {
    await this.assertLPLimitNotReached(userId);
    const landingPage = this.landingPageRope.create({
      productId: dto.productId,
      domain: dto.domain,
      platform: dto.paltform,
      urlImage: dto.urlImage,
    });
    await this.landingPageRope.save(landingPage);
    return { success: true, message: 'create landing Page successfuly' };
  }

  async getByDomain(domain: string) {
    const landingpage = await this.landingPageRope.findOne({
      where: { domain },
      relations: [
        'product', 'product.store', 'product.store.user',
        'product.category', 'product.attributes', 'product.attributes.variants',
        'product.variantDetails', 'product.offers',
      ],
    });
    if (!landingpage) throw new NotFoundException('Landing page not found');

    return {
      ...landingpage,
      product: landingpage.product ? {
        ...landingpage.product,
        store: landingpage.product.store ? {
          id: landingpage.product.store.id,
          name: landingpage.product.store.name,
          subdomain: landingpage.product.store.subdomain,
          userId: landingpage.product.store.user?.id || null,
        } : null,
        category: landingpage.product.category ? {
          id: landingpage.product.category.id,
          name: landingpage.product.category.name,
        } : null,
      } : null,
    };
  }

  // ✅ حذف shows و orders من الـ relations — كانوا يجلبون arrays كاملة
  // استخدم loadRelationCountAndMap بدلاً منها
  async getByStoreId(storeId: string) {
    return this.landingPageRope
      .createQueryBuilder('lp')
      .leftJoin('lp.product', 'product') // المستوى الأول
      .leftJoin('product.store', 'store')  // المستوى الثاني (عبر الاسم المستعار product)
      // ✅ إذا كنت لا تحتاج لبيانات المستخدم فعلياً، احذف السطر التالي تماماً لتوفير البيانات
      .leftJoin('store.user', 'user')

      .leftJoinAndSelect('lp.product', 'p')
      .leftJoinAndSelect('p.category', 'category')
      .leftJoinAndSelect('p.attributes', 'attributes')
      .leftJoinAndSelect('attributes.variants', 'variants')
      .leftJoinAndSelect('p.variantDetails', 'variantDetails')
      .leftJoinAndSelect('p.offers', 'offers')

      // استخدام COUNT بدلاً من جلب المصفوفات كاملة (ممتاز!)
      .loadRelationCountAndMap('lp.showsCount', 'lp.shows')
      .loadRelationCountAndMap('lp.ordersCount', 'lp.orders')

      .where('store.id = :storeId', { storeId })
      .getMany();
  }

  async findOne(id: string) {
    const landingpage = await this.landingPageRope.findOne({
      where: { id },
      relations: [
        'product.store', 'product.store.user', 'product.category',
        'product.attributes', 'product.attributes.variants',
        'product.variantDetails', 'product.offers',
      ],
    });
    if (!landingpage) throw new NotFoundException('not exist landing page');
    return landingpage;
  }

  async update(id: string, dto: UpdateLandingPageDto) {
    const landingpage = await this.landingPageRope.findOne({ where: { id } });
    if (!landingpage) throw new NotFoundException('landing page not found');

    await this.landingPageRope.update(id, {
      productId: dto.productId || landingpage.productId,
      domain: dto.domain || landingpage.domain,
      platform: dto.paltform || landingpage.platform,
      urlImage: dto.urlImage || landingpage.urlImage,
    });
    return { message: 'edit successfully' };
  }

  async toggleStatus(id: string, userId: string) {
    const landingpage = await this.landingPageRope.findOne({ where: { id } });
    if (!landingpage) throw new NotFoundException('landing page not found');

    if (!landingpage.isActive) await this.assertLPLimitNotReached(userId);

    await this.landingPageRope.update(id, { isActive: !landingpage.isActive });
    return !landingpage.isActive;
  }

  async duplicate(id: string) {
    const lp = await this.landingPageRope.findOne({ where: { id } });
    if (!lp) throw new NotFoundException('landing page not found');

    const randomNumber = Math.floor(Math.random() * 1000) + 1;
    return this.landingPageRope.save(
      this.landingPageRope.create({
        productId: lp.productId,
        domain: `${lp.domain}-${randomNumber}`,
        platform: lp.platform,
        urlImage: lp.urlImage,
      })
    );
  }

  async updatePlatfor(id: string, platform: string) {
    const lp = await this.landingPageRope.findOne({ where: { id } });
    if (!lp) throw new NotFoundException('landing page not found');
    await this.landingPageRope.update(id, { platform });
    return { message: 'edit successfully' };
  }

  remove(id: string) {
    return this.landingPageRope.delete(id);
  }

  async generateProductImage(productId: string) {
    const result = await this.aiService.generatePromptProduct(productId);
    return this.aiService.generateProductImage({
      images: result.images,
      prompt: result.prompt,
      productName: (result.product as any).name,
      price: String((result.product as any).price),
    });
  }

  findAll() {
    return `This action returns all landingPage`;
  }
}