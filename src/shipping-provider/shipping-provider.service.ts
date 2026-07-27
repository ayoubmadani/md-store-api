import { BadGatewayException, HttpException, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

import { Order } from '../order/entities/order.entity';
import { SetShippingProviderDto, UpdateShippingProviderDto } from './dto/shipping.dto';

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

  async createOrder(storeId: string, userId: string, orderData: Record<string, unknown>) {
    const order = await this.orderRepo.findOne({
      where: { id: orderData.id as string },
      // يجب إضافة items و items.product لكي تستخدمها شركات الشحن
      relations: ['customerWilaya', 'customerCommune', 'items', 'items.product'],
    });

    if (!order) throw new BadGatewayException('الطلب غير موجود');

    const shippingOrderInput = {
      id: order.id,
      typeShip: order.typeShip,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerWilayaId: order.customerWilayaId,
      customerCommuneId: order.customerCommuneId,
      customerWilaya: { name: order.customerWilaya.name, ar_name: order.customerWilaya.ar_name },
      customerCommune: { name: order.customerCommune.name, ar_name: order.customerCommune.ar_name },
      totalPrice: order.totalPrice,
      items: order.items.map((item) => ({
        quantity: item.quantity,
        product: item.product ? { name: item.product.name } : undefined,
      })),
    };

    return this.forward('post', `/stores/${storeId}/shipping/orders`, userId, {
      data: { order: shippingOrderInput },
    });
  }

  getOrder(storeId: string, userId: string, trackingId: string) {
    return this.forward('get', `/stores/${storeId}/shipping/orders/${trackingId}`, userId);
  }

  getOrderLabel(storeId: string, userId: string, orderId: string) {
    return this.forward('get', `/stores/${storeId}/shipping/orders/${orderId}/label`, userId);
  }
}
