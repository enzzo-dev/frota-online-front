import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../http/api-client';
import {
  CardPayment,
  CustomerDeliveryDetail,
  CustomerDeliverySummary,
  PayWithCardRequest,
  PixPayment,
  WalletPayment,
} from '../models';

/** What a customer sees of the deliveries running for their freights. */
@Injectable({ providedIn: 'root' })
export class CustomerDeliveriesService {
  private readonly api = inject(ApiClient);

  list(): Observable<CustomerDeliverySummary[]> {
    return this.api.get<CustomerDeliverySummary[]>('/deliveries');
  }

  get(deliveryId: string): Observable<CustomerDeliveryDetail> {
    return this.api.get<CustomerDeliveryDetail>(`/deliveries/${deliveryId}`);
  }

  /** Only before pickup (Scheduled or ToPickup). */
  cancel(deliveryId: string, reason: string): Observable<void> {
    return this.api.post<void>(`/deliveries/${deliveryId}/cancel`, { reason });
  }

  /** After the delivery is completed. `taxId` is the CPF or CNPJ of whoever pays. */
  payByPix(deliveryId: string, taxId: string): Observable<PixPayment> {
    return this.api.post<PixPayment>(`/deliveries/${deliveryId}/pix`, { taxId });
  }

  /** Credit card, new or saved. The card travels once to the provider; the API never stores it. */
  payByCard(deliveryId: string, request: PayWithCardRequest): Observable<CardPayment> {
    return this.api.post<CardPayment>(`/deliveries/${deliveryId}/card`, request);
  }

  /** Apple Pay through the Mercado Pago SDK: `cardToken` is what the SDK returned. */
  payByWallet(deliveryId: string, cardToken: string, paymentMethodId: string): Observable<WalletPayment> {
    return this.api.post<WalletPayment>(`/deliveries/${deliveryId}/wallet`, { cardToken, paymentMethodId });
  }
}
