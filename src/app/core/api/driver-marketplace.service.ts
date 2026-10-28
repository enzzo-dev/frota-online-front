import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../http/api-client';
import {
  CancelDeliveryRequest,
  CompleteStopRequest,
  ConfirmPaymentRequest,
  DeliveryProgress,
  DeliveryRoute,
  DriverDeliverySummary,
  DriverMetrics,
  OpenFreight,
  PaymentResponse,
  Proposal,
  RouteMap,
  RouteView,
  SubmitProposalRequest,
  UpdateLocationRequest,
} from '../models';

/** What an approved driver does: browse freights, bid, and run the deliveries they won. */
@Injectable({ providedIn: 'root' })
export class DriverMarketplaceService {
  private readonly api = inject(ApiClient);

  openFreights(): Observable<OpenFreight[]> {
    return this.api.get<OpenFreight[]>('/driver/freights/open');
  }

  markSeen(freightId: string): Observable<void> {
    return this.api.post<void>(`/freights/${freightId}/view`);
  }

  metrics(from?: string, to?: string): Observable<DriverMetrics> {
    const params: Record<string, string> = {};
    if (from) {
      params['from'] = from;
    }
    if (to) {
      params['to'] = to;
    }
    return this.api.get<DriverMetrics>('/driver/metrics', params);
  }

  submitProposal(freightId: string, request: SubmitProposalRequest): Observable<Proposal> {
    return this.api.post<Proposal>(`/driver/freights/${freightId}/proposals`, request);
  }

  proposals(): Observable<Proposal[]> {
    return this.api.get<Proposal[]>('/driver/proposals');
  }

  withdrawProposal(proposalId: string): Observable<void> {
    return this.api.post<void>(`/driver/proposals/${proposalId}/withdraw`);
  }

  deliveries(): Observable<DriverDeliverySummary[]> {
    return this.api.get<DriverDeliverySummary[]>('/driver/deliveries');
  }

  /** One delivery with its current status and payment, so a screen does not have to load the whole list. */
  delivery(deliveryId: string): Observable<DriverDeliverySummary> {
    return this.api.get<DriverDeliverySummary>(`/driver/deliveries/${deliveryId}`);
  }

  route(deliveryId: string, view: RouteView): Observable<DeliveryRoute> {
    return this.api.get<DeliveryRoute>(`/driver/deliveries/${deliveryId}/route`, { view });
  }

  /** Exact pins and path of a delivery the driver won. */
  routeMap(deliveryId: string): Observable<RouteMap> {
    return this.api.get<RouteMap>(`/driver/deliveries/${deliveryId}/map`);
  }

  sendLocation(deliveryId: string, request: UpdateLocationRequest): Observable<void> {
    return this.api.put<void>(`/driver/deliveries/${deliveryId}/location`, request);
  }

  start(deliveryId: string): Observable<DeliveryProgress> {
    return this.api.post<DeliveryProgress>(`/driver/deliveries/${deliveryId}/start`);
  }

  completeStop(deliveryId: string, stopId: string, request: CompleteStopRequest): Observable<DeliveryProgress> {
    return this.api.post<DeliveryProgress>(`/driver/deliveries/${deliveryId}/stops/${stopId}/complete`, request);
  }

  reportIncident(deliveryId: string, note: string): Observable<DeliveryProgress> {
    return this.api.post<DeliveryProgress>(`/driver/deliveries/${deliveryId}/incident`, { note });
  }

  cancel(deliveryId: string, request: CancelDeliveryRequest): Observable<DeliveryProgress> {
    return this.api.post<DeliveryProgress>(`/driver/deliveries/${deliveryId}/cancel`, request);
  }

  confirmPayment(deliveryId: string, request: ConfirmPaymentRequest): Observable<PaymentResponse> {
    return this.api.post<PaymentResponse>(`/driver/deliveries/${deliveryId}/payment`, request);
  }
}
