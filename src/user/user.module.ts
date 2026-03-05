import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MailModule } from "../mail/mail.module";
import { User } from "./entities/user.entity";
import { UserController } from "./user.controller";
import { UserService } from "./user.service";

// user.module.ts
@Module({
  imports: [
    TypeOrmModule.forFeature([User]), 
    MailModule,
    ConfigModule, // <<< تأكد من إضافة هذا السطر هنا
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService], 
})
export class UserModule {}