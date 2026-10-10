import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../http/api-client';
import {
  DeliveryRoute,
  DriverDeliverySummary,
  OpenFreight,
  Proposal,
  RouteView,
  SubmitProposalRequest,
} from '../models';

/** What an approved driver does: browse freights, bid, and run the deliveries they won. */
@Injectable({ providedIn: 'root' })
export class DriverMarketplaceService {
  private readonly api = inject(ApiClient);

  openFreights(): Observable<OpenFreight[]> {
    return this.api.get<OpenFreight[]>('/driver/freights/open');
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

  route(deliveryId: string, view: RouteView): Observable<DeliveryRoute> {
    return this.api.get<DeliveryRoute>(`/driver/deliveries/${deliveryId}/route`, { view });
  }
}
