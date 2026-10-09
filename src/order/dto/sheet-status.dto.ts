import { IsEnum } from 'class-validator';
import { StatusEnum } from '../entities/order.entity';

export class SheetStatusDto {
  @IsEnum(StatusEnum)
  status: StatusEnum;
}
