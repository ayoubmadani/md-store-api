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
        // نجهز تاريخ اليوم بصيغة YYYY-MM-DD
        const today = new Date().toISOString().split('T')[0];

        // upsert() على عمود nullable لا يعمل: في Postgres قيمتان NULL لا تُعتبران متطابقتين
        // ضمن قيد Unique، وبما أن productId/storeId/lpId/builderPageId غالباً NULL (كل
        // صفحة تمرر واحداً منها فقط)، كان القيد الحالي لا يمنع أي تكرار عملياً. لذا نتحقق
        // يدوياً عن وجود سجل بنفس الزائر + نفس السياق (بمطابقة صريحة على NULL) + نفس اليوم.
        const existing = await this.showRepo.findOne({
            where: {
                visitorId: dto.visitorId,
                dayDate: today,
                productId: dto.productId ?? IsNull(),
                storeId: dto.storeId ?? IsNull(),
                lpId: dto.lpId ?? IsNull(),
                builderPageId: dto.builderPageId ?? IsNull(),
            },
        });

        if (existing) {
            return { success: true };
        }

        await this.showRepo.save(this.showRepo.create({ ...dto, dayDate: today }));
        return { success: true };
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