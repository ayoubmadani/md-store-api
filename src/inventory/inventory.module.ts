import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { StockMovement } from './stock-movement.entity';

// عام: الطلبات، التأكيد، الشحن والأدمن يستدعون safeReconcile بعد تغيير الطلب
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([StockMovement])], // TeamModule عام (StoreAccessGuard متاح للجميع)
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule { }
