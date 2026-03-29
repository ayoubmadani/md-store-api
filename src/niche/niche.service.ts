import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Niche } from './entities/niche.entity';
import { CreateNicheDto } from './dto/create-niche.dto';
import { UpdateNicheDto } from './dto/update-niche.dto';
 
@Injectable()
export class NicheService {
    // ✅ cache بسيط — niches بيانات ثابتة تقريباً لا تتغير
    private cache: Niche[] | null = null;
 
    constructor(
        @InjectRepository(Niche)
        private readonly nicheRepository: Repository<Niche>,
    ) {}
 
    async create(createNicheDto: CreateNicheDto[]): Promise<Niche[]> {
        this.cache = null; // invalidate
        const niche = this.nicheRepository.create(createNicheDto);
        return this.nicheRepository.save(niche);
    }
 
    // ✅ بدون relations: ['stores'] — كان يجلب كل المتاجر مع كل niche
    async findAll(): Promise<Niche[]> {
        if (this.cache) return this.cache;
        this.cache = await this.nicheRepository.find();
        return this.cache;
    }
 
    async findOne(id: string): Promise<Niche> {
        // ✅ بدون relations: ['stores']
        const niche = await this.nicheRepository.findOne({ where: { id } });
        if (!niche) throw new NotFoundException(`Niche with id ${id} not found`);
        return niche;
    }
 
    async update(id: string, updateNicheDto: UpdateNicheDto): Promise<Niche> {
        const niche = await this.findOne(id);
        Object.assign(niche, updateNicheDto);
        this.cache = null; // invalidate
        return this.nicheRepository.save(niche);
    }
 
    async remove(id: string): Promise<void> {
        const niche = await this.findOne(id);
        this.cache = null; // invalidate
        await this.nicheRepository.remove(niche);
    }
}