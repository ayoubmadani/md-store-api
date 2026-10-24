import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PushController } from './push.controller';
import { PushService } from './push.service';
import { PushSubscriptionEntity } from './push-subscription.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([PushSubscriptionEntity])],
  controllers: [PushController],
  providers: [PushService],
  exports: [PushService],
})
export class PushModule {}
