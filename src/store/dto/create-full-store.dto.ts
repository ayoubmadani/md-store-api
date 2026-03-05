// create-full-store.dto.ts
import { ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateStoreDto } from './create-store.dto';
import { CreateStoreDesignDto } from './create-store-design.dto';
import { CreateStoreTopBarDto } from './create-store-topbar.dto';
import { CreateStoreContactDto } from './create-store-contact.dto';
import { CreateStoreHeroDto } from './create-store-hero.dto';

export class CreateFullStoreDto {
  @ValidateNested() @Type(() => CreateStoreDto) store: CreateStoreDto;
  @ValidateNested() @Type(() => CreateStoreDesignDto) design: CreateStoreDesignDto;
  @ValidateNested() @Type(() => CreateStoreTopBarDto) topBar: CreateStoreTopBarDto;
  @ValidateNested() @Type(() => CreateStoreContactDto) contact: CreateStoreContactDto;
  @ValidateNested() @Type(() => CreateStoreHeroDto) hero: CreateStoreHeroDto;
}

