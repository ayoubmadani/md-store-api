export class Subscription {
    id: string;
    userId: string;      // من هو المستخدم؟
    planId: string;      // أي خطة اختار؟ (إشارة لـ Plan.id)
    
    status: 'active' | 'canceled' | 'expired'; 
    startDate: Date;
    endDate: Date;       // موعد انتهاء الوصول للميزات
}