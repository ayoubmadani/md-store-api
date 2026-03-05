import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateLandingPageDto } from './dto/create-landing-page.dto';
import { UpdateLandingPageDto } from './dto/update-landing-page.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { LandingPage } from './entities/landing-page.entity';
import { Repository } from 'typeorm';
import { ImageGeneratorService } from 'src/image-generator/image-generator.service';

@Injectable()
export class LandingPageService {

  constructor(
    @InjectRepository(LandingPage)
    private readonly landingPageRope: Repository<LandingPage>,
    private readonly imageGeneratorService: ImageGeneratorService,
  ) {}

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

  findOne(id: number) {
    return `This action returns a #${id} landingPage`;
  }

  update(id: number, updateLandingPageDto: UpdateLandingPageDto) {
    return `This action updates a #${id} landingPage`;
  }

  remove(id: number) {
    return `This action removes a #${id} landingPage`;
  }

  // ─────────────────────────────────────────
  // توليد صورة Landing Page
  // ─────────────────────────────────────────

  async generateProductImage(productId: string) {}
    
}