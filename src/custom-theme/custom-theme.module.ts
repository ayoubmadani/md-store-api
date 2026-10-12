import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentModule } from '../payment/payment.module';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { ImageModule } from '../image/image.module';
import { Store } from '../store/entities/store.entity';
import { Theme } from '../theme/entities/theme.entity';
import { ThemeType } from '../theme/entities/theme-type.entity';
import { ThemeUser } from '../theme/entities/theme-user.entity';
import { ThemeCodeService } from '../admin/theme-code.service';
import { CustomThemeOrder } from './entities/custom-theme-order.entity';
import { CustomThemeJob } from './entities/custom-theme-job.entity';
import { CustomThemeService } from './custom-theme.service';
import { CustomThemeGenerator } from './custom-theme-generator';
import { AdminCustomThemeController, CustomThemeController, CustomThemeCronController } from './custom-theme.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([CustomThemeOrder, CustomThemeJob, Store, Theme, ThemeType, ThemeUser]),
    PaymentModule,
    PlatformSettingsModule,
    ImageModule,
  ],
  controllers: [CustomThemeController, AdminCustomThemeController, CustomThemeCronController],
  providers: [CustomThemeService, CustomThemeGenerator, ThemeCodeService],
})
export class CustomThemeModule { }
