import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MailModule } from "../mail/mail.module";
import { User } from "./entities/user.entity";
import { UserController } from "./user.controller";
import { UserService } from "./user.service";
import { SubscriptionModule } from "../subscription/subscription.module";

// user.module.ts
@Module({
  imports: [
    TypeOrmModule.forFeature([User]), 
    MailModule,
    ConfigModule,
    SubscriptionModule,
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService], 
})
export class UserModule {}