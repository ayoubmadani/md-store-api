import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Show } from "./entity/show.entity";
import { Repository, Not, IsNull, MoreThan } from "typeorm";
import { AddShowDto } from "./dto/add-show.dto";

@Injectable()
export class ShowServices {
    constructor(
        @InjectRepository(Show)
        private readonly showRepo: Repository<Show>
    ) { }

    // أضفت async و await لضمان حفظ البيانات فعلياً في قاعدة البيانات

    // ... داخل الكلاس
    async addShow(dto: AddShowDto) {
        console.log(dto);
        
        try {
            // نجهز تاريخ اليوم بصيغة YYYY-MM-DD
            const today = new Date().toISOString().split('T')[0];

            // upsert تعني: "أضف السجل، وإذا كان موجوداً مسبقاً (بناءً على الـ Unique) فلا تفعل شيئاً"
            await this.showRepo.upsert(
                {
                    ...dto,
                    dayDate: today, // نمرر تاريخ اليوم للمقارنة
                },
                {
                    conflictPaths: ['visitorId', 'productId', 'storeId', 'dayDate'],
                    skipUpdateIfNoValuesChanged: true, // لا تقم بتحديث السجل إذا كان موجوداً
                }
            );

            return { success: true };
        } catch (error) {
            // في حال فشل الـ upsert بسبب التكرار، لن ينهار السيرفر بل سيتجاهل الطلب
            return { success: false, message: 'Request ignored to prevent duplication' };
        }
    }
    // الطريقة الصحيحة للتحقق من أن الحقل ليس null في TypeORM هي Not(IsNull())
    async getCountShowStore(userId: string) {
        return await this.showRepo.count({
            where: {
                storeId: Not(IsNull()),
                store: { user: { id: userId } }
            }
        });
    }

    async getCountShowProduct(userId: string) {
        return await this.showRepo.count({
            where: {
                productId: Not(IsNull()),
                product: { store: { user: { id: userId } } }
            }
        });
    }
}