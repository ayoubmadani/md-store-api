import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKey } from './entities/api-key.entity';
import { ApiKeyService } from './api-key.service';
import { ApiKeyController } from './api-key.controller';

// Global لأن AuthGuard يحتاج ApiKeyService، والـ guard يُنشأ داخل كل موديول
// يستعمله — بدون هذا يجب استيراد ApiKeyModule في كل تلك الموديولات.
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ApiKey])],
  controllers: [ApiKeyController],
  providers: [ApiKeyService],
  exports: [ApiKeyService],
})
export class ApiKeyModule {}
