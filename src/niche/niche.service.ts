// niche.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Niche } from './entities/niche.entity';
import { CreateNicheDto } from './dto/create-niche.dto';
import { UpdateNicheDto } from './dto/update-niche.dto';

@Injectable()
export class NicheService {
  constructor(
    @InjectRepository(Niche)
    private readonly nicheRepository: Repository<Niche>,
  ) {}

  // إنشاء Niche جديد
  async create(createNicheDto: CreateNicheDto): Promise<Niche> {
    const niche = this.nicheRepository.create(createNicheDto);
    return this.nicheRepository.save(niche);
  }

  // جلب كل الـ Niches
  async findAll(): Promise<Niche[]> {
    return this.nicheRepository.find({
      relations: ['stores'], // لو حابب تجيب المتاجر المرتبطة
    });
  }

  // جلب Niche واحدة بالـ id
  async findOne(id: string): Promise<Niche> {
    const niche = await this.nicheRepository.findOne({
      where: { id },
      relations: ['stores'],
    });
    if (!niche) {
      throw new NotFoundException(`Niche with id ${id} not found`);
    }
    return niche;
  }

  // تحديث Niche
  async update(id: string, updateNicheDto: UpdateNicheDto): Promise<Niche> {
    const niche = await this.findOne(id); // يتأكد أنه موجود
    Object.assign(niche, updateNicheDto);
    return this.nicheRepository.save(niche);
  }

  // حذف Niche
  async remove(id: string): Promise<void> {
    const niche = await this.findOne(id);
    await this.nicheRepository.remove(niche);
  }
}