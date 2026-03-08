import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ThemeType } from "./entities/theme-type.entity";
import { Repository } from "typeorm";
import { PaymentService } from "../payment/payment.service";

@Injectable()
export class TypeThemeService {
    constructor(
        @InjectRepository(ThemeType)
        private readonly themeTypeRepo: Repository<ThemeType>, // يفضل تسميته Repo للوضوح
    ) { }

    async create(name: string) {
        // 1. إنشاء الكائن (Instance)
        const newType = this.themeTypeRepo.create({ name });

        // 2. حفظ الكائن في قاعدة البيانات (هذا هو السطر الناقص)
        return await this.themeTypeRepo.save(newType);
    }

    // دالة إضافية لجلب كل الأنواع (ستحتاجها للـ Sidebar في الـ Admin)
    async findAll() {
        return await this.themeTypeRepo.find();
    }

    async delete(id: string) {
        // حذف مباشر باستخدام الـ ID (String/UUID)
        const result = await this.themeTypeRepo.delete(id);

        if (result.affected === 0) {
            return { success: false, message: "Type not found" };
        }

        return { success: true, message: "Deleted Successfully" };
    }
}