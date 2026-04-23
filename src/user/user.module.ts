import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MailModule } from "../mail/mail.module";
import { User } from "./entities/user.entity";
import { UserController } from "./user.controller";
import { UserService } from "./user.service";
import { SubscriptionModule } from "../subscription/subscription.module";
import { Store } from "../store/entities/store.entity";
import { Product } from "../product/entities/product.entity";
import { Subscription } from "../subscription/entities/subscription.entity";
import { StorePixel } from "../store/entities/store-pixel.entity";
import { LandingPage } from "../landing-page/entities/landing-page.entity";
import { MessageUser } from "./entities/message-user.entity";
import { Theme } from "../theme/entities/theme.entity";
import { ThemeUser } from "../theme/entities/theme-user.entity";

// user.module.ts
@Module({
  imports: [
    TypeOrmModule.forFeature([User,Store , Product , Subscription , StorePixel , LandingPage , MessageUser,Theme,ThemeUser,]),
    MailModule,
    ConfigModule,
    SubscriptionModule,
    
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule { }