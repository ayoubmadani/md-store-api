export class Plan {
    id: string;          // المعرف الفريد (مثلاً UUID)
    name: string;        // اسم الخطة: "Free", "Pro", "Enterprise"
    
    price: number;       // سعر الخطة (مثلاً: 29.99)
    currency: string;    // العملة (مثلاً: "USD" أو "SAR")
    
    interval: 'month' | 'year'; // دورة التجديد (شهري أم سنوي)

    // ميزات الخطة (مثلاً: ["10GB Storage", "24/7 Support"])
    features: string[];  

    // هذا الحقل مهم جداً لربط الخطة ببوابة دفع مثل Stripe
    stripePriceId?: string; 

    isActive: boolean;   // هل الخطة متاحة حالياً للشراء؟
}