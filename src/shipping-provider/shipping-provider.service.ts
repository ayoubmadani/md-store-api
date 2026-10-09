import { BadGatewayException, BadRequestException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

import { Order, StatusEnum } from '../order/entities/order.entity';
import { SetShippingProviderDto, UpdateShippingProviderDto } from './dto/shipping.dto';

/** رقم التتبع من رد شركة التوصيل — كل شركة تضعه في مكان/اسم مختلف */
export function extractTracking(res: unknown, depth = 0): string | null {
  if (!res || typeof res !== 'object' || depth > 3) return null;
  for (const [key, value] of Object.entries(res as Record<string, unknown>)) {
    if (/^tracking(_?id|_?number)?$/i.test(key) && (typeof value === 'string' || typeof value === 'number') && String(value).trim()) {
      return String(value).trim();
    }
  }
  for (const value of Object.values(res as Record<string, unknown>)) {
    const found = extractTracking(value, depth + 1);
    if (found) return found;
  }
  return null;
}

@Injectable()
export class ShippingProviderService {
  private readonly baseUrl: string;
  private readonly internalKey: string;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {
    this.baseUrl = this.config.get<string>('SHIPPING_PROVIDER_URL')!;
    this.internalKey = this.config.get<string>('INTERNAL_API_KEY')!;
  }

  private headers(userId: string) {
    return {
      'x-internal-key': this.internalKey,
      'x-user-id': userId,
    };
  }

  private async forward<T = any>(
    method: 'get' | 'post' | 'patch' | 'delete',
    path: string,
    userId: string,
    options: { params?: Record<string, unknown>; data?: unknown } = {},
  ): Promise<T> {
    try {
      const { data } = await firstValueFrom(
        this.http.request<T>({
          method,
          url: `${this.baseUrl}${path}`,
          headers: this.headers(userId),
          params: options.params,
          data: options.data,
        }),
      );
      return data;
    } catch (error) {
      const axiosError = error as AxiosError<{ message?: string }>;
      if (axiosError.response) {
        // إعادة نفس status code والرسالة القادمة من shipping-provider (404، 400، إلخ)
        // بدلاً من إخفائها خلف 502 دائماً
        throw new HttpException(
          axiosError.response.data?.message ?? 'Shipping provider service error',
          axiosError.response.status,
        );
      }
      throw new BadGatewayException('Shipping provider service is unreachable');
    }
  }

  // ─── مزودي الخدمة المتاحين ───
  getAllProviders(storeId: string) {
    return this.forward('get', `/stores/${storeId}/shipping/providers`, '_');
  }

  // ─── إدارة الحسابات (مرتبطة بالمستخدم) ───

  getStoreAccounts(storeId: string, userId: string) {
    return this.forward('get', `/stores/${storeId}/shipping/accounts`, userId);
  }

  createAccount(storeId: string, userId: string, dto: SetShippingProviderDto) {
    return this.forward('post', `/stores/${storeId}/shipping/accounts`, userId, { data: dto });
  }

  updateAccount(storeId: string, userId: string, accountId: string, dto: UpdateShippingProviderDto) {
    return this.forward('patch', `/stores/${storeId}/shipping/accounts/${accountId}`, userId, {
      data: dto,
    });
  }

  setDefaultAccount(storeId: string, userId: string, accountId: string) {
    return this.forward(
      'patch',
      `/stores/${storeId}/shipping/accounts/${accountId}/default`,
      userId,
    );
  }

  deleteAccount(storeId: string, userId: string, accountId: string) {
    return this.forward('delete', `/stores/${storeId}/shipping/accounts/${accountId}`, userId);
  }

  // ─── عمليات الشحن ───

  testCredentials(storeId: string, userId: string) {
    return this.forward('get', `/stores/${storeId}/shipping/test-credentials`, userId);
  }

  getRates(storeId: string, userId: string, fromWilayaId?: number, toWilayaId?: number) {
    return this.forward('get', `/stores/${storeId}/shipping/rates`, userId, {
      params: { fromWilayaId, toWilayaId },
    });
  }

  getValidationRules(storeId: string, userId: string) {
    return this.forward('get', `/stores/${storeId}/shipping/validation-rules`, userId);
  }

  /**
   * رفع طلب إلى شركة التوصيل بحساب التاجر، ثم حفظ رقم التتبع وتحويل الحالة
   * إلى "قيد الشحن". يُستعمل من زر الشحن في الداشبورد ومن التأكيد التلقائي.
   */
  async uploadOrder(storeId: string, userId: string, orderId: string) {
    if (!orderId) throw new BadRequestException('orderId مطلوب');

    // storeId في الشرط: لا يمكن شحن طلب متجر آخر
    const order = await this.orderRepo.findOne({
      where: { id: orderId, storeId },
      relations: ['customerWilaya', 'customerCommune', 'items', 'items.product'],
    });

    if (!order) throw new NotFoundException('الطلب غير موجود');
    if (order.shippingTrackingId) throw new BadRequestException('هذا الطلب مرفوع لشركة التوصيل مسبقاً');
    if (!order.customerWilaya || !order.customerCommune) {
      throw new BadRequestException('لا يمكن شحن طلب رقمي — لا توجد بيانات ولاية/بلدية لهذا الطلب');
    }

    const itemsTotal = order.items.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);
    const shippingOrderInput = {
      id: order.id,
      typeShip: order.typeShip,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerWilayaId: order.customerWilayaId,
      customerCommuneId: order.customerCommuneId,
      customerWilaya: { name: order.customerWilaya.name, ar_name: order.customerWilaya.ar_name },
      customerCommune: { name: order.customerCommune.name, ar_name: order.customerCommune.ar_name },
      // المبلغ الذي يحصّله الموزّع من الزبون: المنتجات + التوصيل
      totalPrice: itemsTotal + Number(order.priceShip || 0),
      items: order.items.map((item) => ({
        quantity: item.quantity,
        product: item.product ? { name: item.product.name } : undefined,
      })),
    };

    const result = await this.forward<Record<string, unknown>>('post', `/stores/${storeId}/shipping/orders`, userId, {
      data: { order: shippingOrderInput },
    });

    const trackingId = extractTracking(result);
    await this.orderRepo.update(order.id, {
      shippingTrackingId: trackingId ?? undefined,
      isUploadedShipping: true,
      status: StatusEnum.SHIPPING,
      shippingAt: new Date(),
    });

    return { ...result, tracking: trackingId };
  }

  /**
   * رقم تتبع يُدخله التاجر يدوياً (طرد رُفع خارج المنصة، أو قبل حفظ الأرقام تلقائياً).
   * الطلبية تصبح "قيد الشحن" وتدخل مزامنة الحالة مع شركة التوصيل في الدورة القادمة.
   */
  async setTracking(storeId: string, orderId: string, trackingId: string) {
    const tracking = trackingId?.trim();
    if (!tracking) throw new BadRequestException('رقم التتبع مطلوب');
    const order = await this.orderRepo.findOne({ where: { id: orderId, storeId } });
    if (!order) throw new NotFoundException('الطلب غير موجود');
    if (order.isDigital) throw new BadRequestException('الطلبية الرقمية لا تُشحن');
    if (![StatusEnum.CONFIRMED, StatusEnum.SHIPPING].includes(order.status)) {
      throw new BadRequestException('رقم التتبع يُضاف لطلبية مؤكدة أو قيد الشحن فقط');
    }
    await this.orderRepo.update(order.id, {
      shippingTrackingId: tracking,
      isUploadedShipping: true,
      status: StatusEnum.SHIPPING,
      shippingAt: order.shippingAt ?? new Date(),
      shippingCheckedAt: null as any, // تُفحص في أول دورة مزامنة
      shippingProviderStatus: null as any,
    });
    return { id: order.id, status: StatusEnum.SHIPPING, shippingTrackingId: tracking };
  }

  getOrder(storeId: string, userId: string, trackingId: string) {
    return this.forward('get', `/stores/${storeId}/shipping/orders/${trackingId}`, userId);
  }

  getOrderLabel(storeId: string, userId: string, orderId: string) {
    return this.forward('get', `/stores/${storeId}/shipping/orders/${orderId}/label`, userId);
  }
}
