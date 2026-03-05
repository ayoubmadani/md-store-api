// update-full-store.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateFullStoreDto } from './create-full-store.dto';

export class UpdateFullStoreDto extends PartialType(CreateFullStoreDto) {}