import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ThemeType } from "./entities/theme-type.entity";
import { Not, In, Repository } from "typeorm";
import { PaymentService } from "../payment/payment.service";
import { HIDDEN_TYPE_NAMES } from "./theme.constants";

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
    async findAll(isAdmin: boolean = false) {
        if (isAdmin) {
            return await this.themeTypeRepo.find();
        }
        return await this.themeTypeRepo.find({
            where: { name: Not(In(HIDDEN_TYPE_NAMES)) },
        });
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