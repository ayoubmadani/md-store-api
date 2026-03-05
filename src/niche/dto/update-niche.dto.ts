// update-niche.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateNicheDto } from './create-niche.dto';

export class UpdateNicheDto extends PartialType(CreateNicheDto) {}