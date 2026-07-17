import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateBuilderPageDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  storeId: string;

  @IsString()
  @IsOptional()
  productId?: string;

  // Full publish path, e.g. "mystore.mdstore.top/lp/summer-sale" — if
  // omitted, the service derives one from the domain + slugified name.
  @IsString()
  @IsOptional()
  domain?: string;

  // Ad-campaign source tag, e.g. "tiktok"/"facebook" — free text, same
  // convention as the older landing-page module. Defaults to "md store" on
  // the entity if omitted.
  @IsString()
  @IsOptional()
  platform?: string;
}
