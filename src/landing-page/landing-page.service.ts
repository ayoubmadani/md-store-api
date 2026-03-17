import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateLandingPageDto } from './dto/create-landing-page.dto';
import { UpdateLandingPageDto } from './dto/update-landing-page.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { LandingPage } from './entities/landing-page.entity';
import { Repository } from 'typeorm';
import { AiService } from '../ai/ai.service';

@Injectable()
export class LandingPageService {

  constructor(
    @InjectRepository(LandingPage)
    private readonly landingPageRope: Repository<LandingPage>,

    private readonly aiService: AiService,
  ) { }

  // ─────────────────────────────────────────
  // CRUD
  // ─────────────────────────────────────────

  async create(dto: CreateLandingPageDto) {
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
        'product',
        'product.store',
        'product.store.user',
        'product.category',
        'product.attributes',
        'product.attributes.variants',
        'product.variantDetails',
        'product.offers',
      ],
    });

    if (!landingpage) {
      throw new NotFoundException('Landing page not found');
    }

    return {
      ...landingpage,
      product: landingpage.product
        ? {
          ...landingpage.product,
          store: landingpage.product.store
            ? {
              id: landingpage.product.store.id,
              name: landingpage.product.store.name,
              subdomain: landingpage.product.store.subdomain,
              userId: landingpage.product.store.user?.id || null,
            }
            : null,
          category: landingpage.product.category
            ? {
              id: landingpage.product.category.id,
              name: landingpage.product.category.name,
            }
            : null,
        }
        : null,
    };
  }

  async getByStoreId(storeId: string) {
    const landingpage = await this.landingPageRope.find({
      where: { product: { store: { id: storeId } } },
      relations: [
        'product.store',
        'product.store.user',
        'product.category',
        'product.attributes',
        'product.attributes.variants',
        'product.variantDetails',
        'product.offers',
      ],
    });

    if (!landingpage) {
      throw new NotFoundException('not exist landing page');
    }

    return landingpage;
  }

  findAll() {
    return `This action returns all landingPage`;
  }

  async findOne(id: string) {
    const landingpage = await this.landingPageRope.findOne({
      where: { id },
      relations: [
        'product.store',
        'product.store.user',
        'product.category',
        'product.attributes',
        'product.attributes.variants',
        'product.variantDetails',
        'product.offers',
      ],
    });

    if (!landingpage) {
      throw new NotFoundException('not exist landing page');
    }

    return landingpage;
  }

  async update(id: string, dto: UpdateLandingPageDto) {
    const landingpage = await this.landingPageRope.findOne({ where: { id } })
    if (!landingpage) {
      throw new NotFoundException('landing page note found')
    }

    await this.landingPageRope.update(id, {
      productId: dto.productId || landingpage.productId,
      domain: dto.domain || landingpage.domain,
      platform: dto.paltform || landingpage.platform,
      urlImage: dto.urlImage || landingpage.urlImage,
    });

    return { message: 'edit successfully' }
  }

  async toggleStatus(id: string) {
    const landingpage = await this.landingPageRope.findOne({ where: { id } })
    if (!landingpage) {
      throw new NotFoundException('landing page note found')
    }

    await this.landingPageRope.update(id, {
      isActive: !landingpage.isActive
    });

    return !landingpage.isActive

  }

  async duplicate(id: string) {
    const getlandingpage = await this.landingPageRope.findOne({ where: { id } })
    if (!getlandingpage) {
      throw new NotFoundException('landing page note found')
    }
    const randomNumber = Math.floor(Math.random() * 1000) + 1;
    const landingPage = this.landingPageRope.create({
      productId: getlandingpage.productId,
      domain: `${getlandingpage.domain}-${randomNumber}`,
      platform: getlandingpage.platform,
      urlImage: getlandingpage.urlImage,
    });

    return this.landingPageRope.save(landingPage)
  }

  async updatePlatfor(id:string, platform: string) {
    const getlandingpage = await this.landingPageRope.findOne({ where: { id } })
    if (!getlandingpage) {
      throw new NotFoundException('landing page note found')
    }

    await this.landingPageRope.update(id, {
      platform: platform
    });

    return { message: 'edit successfully' }
  }

  remove(id: string) {
    return this.landingPageRope.delete(id)
  }

  // ─────────────────────────────────────────
  // توليد صورة Landing Page
  // ─────────────────────────────────────────

  async generateProductImage(productId: string) {
    const result = await this.aiService.generatePromptProduct(productId);

    return this.aiService.generateProductImage({
      images: result.images,
      prompt: result.prompt,
      productName: (result.product as any).name,
      price: String((result.product as any).price),
    });
  }

}