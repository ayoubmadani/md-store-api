import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AliexpressAccount } from './entities/aliexpress-account.entity';
import { AliexpressService } from './aliexpress.service';
import { AliexpressController } from './aliexpress.controller';

@Module({
  imports: [TypeOrmModule.forFeature([AliexpressAccount])],
  controllers: [AliexpressController],
  providers: [AliexpressService],
})
export class AliexpressModule {}
