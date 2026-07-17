import { IsArray, IsNotEmpty, IsObject, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateTreeDto {
  // Without this, the global ValidationPipe's `enableImplicitConversion`
  // silently empties every array element down to `{}` — it has no type
  // hint for `Record<string, any>` elements and, under implicit
  // conversion, drops their properties instead of leaving them as plain
  // objects. This was the actual cause of every "block became []" bug in
  // this session — not the frontend, not TypeORM, but this exact gap.
  @IsArray()
  @IsNotEmpty()
  @Type(() => Object)
  tree: Record<string, any>[];

  // A single plain object (not an array of them) isn't affected by the
  // implicit-conversion gap above — verified empirically earlier in this
  // codebase (see CreatePixelDto.customData) — so no @Type() needed here.
  @IsObject()
  @IsOptional()
  settings?: Record<string, any>;
}
