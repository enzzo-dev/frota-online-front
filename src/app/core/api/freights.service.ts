import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../http/api-client';
import {
  ApprovedDelivery,
  CreateFreightRequest,
  Freight,
  FreightStatus,
  RankedProposal,
  RouteMap,
} from '../models';

/** What a customer does with their freights. */
@Injectable({ providedIn: 'root' })
export class FreightsService {
  private readonly api = inject(ApiClient);

  create(request: CreateFreightRequest): Observable<Freight> {
    return this.api.post<Freight>('/freights', request);
  }

  list(status?: FreightStatus): Observable<Freight[]> {
    return this.api.get<Freight[]>('/freights', { status });
  }

  get(freightId: string): Observable<Freight> {
    return this.api.get<Freight>(`/freights/${freightId}`);
  }

  cancel(freightId: string): Observable<void> {
    return this.api.post<void>(`/freights/${freightId}/cancel`);
  }

  /** Pending proposals still inside the window, cheapest first. */
  proposals(freightId: string): Observable<RankedProposal[]> {
    return this.api.get<RankedProposal[]>(`/freights/${freightId}/proposals`);
  }

  approve(freightId: string, proposalId: string): Observable<ApprovedDelivery> {
    return this.api.post<ApprovedDelivery>(`/freights/${freightId}/proposals/${proposalId}/approve`);
  }

  /** Distance, time and map of a run that is not published yet. Call it once the addresses are chosen and ordered. */
  routePreview(addressIds: readonly string[]): Observable<RouteMap> {
    return this.api.post<RouteMap>('/freights/route-preview', { addressIds });
  }

  uploadCargoPhoto(freightId: string, image: string): Observable<void> {
    return this.api.post<void>(`/freights/${freightId}/cargo-photo`, { image });
  }

  cargoPhoto(freightId: string): Observable<Blob> {
    return this.api.getBlob(`/freights/${freightId}/cargo-photo`);
  }

  /** The route of a freight already created; every pin carries its stop type. */
  route(freightId: string): Observable<RouteMap> {
    return this.api.get<RouteMap>(`/freights/${freightId}/route`);
  }
}
