import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Wallet } from './entities/wallets.entity';
import { Transaction } from './entities/transaction.entity';
import { CryptoTopup } from './binance/crypto-topup.entity';
import { BinanceDepositClient } from './binance/binance-deposit.client';
import { BinanceTopupService } from './binance/binance-topup.service';

@Module({
  controllers: [PaymentController],
  providers: [PaymentService, BinanceDepositClient, BinanceTopupService],
  exports: [PaymentService], // ✅ مهم جداً - لتصدير الخدمة للوحدات الأخرى
  imports: [
    TypeOrmModule.forFeature([Wallet, Transaction, CryptoTopup])
  ],
})
export class PaymentModule {}