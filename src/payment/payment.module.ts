import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Wallet } from './entities/wallets.entity';
import { Transaction } from './entities/transaction.entity';

@Module({
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService], // ✅ مهم جداً - لتصدير الخدمة للوحدات الأخرى
  imports: [
    TypeOrmModule.forFeature([Wallet, Transaction])
  ],
})
export class PaymentModule {}