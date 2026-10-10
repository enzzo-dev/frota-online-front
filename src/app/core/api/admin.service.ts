import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../http/api-client';
import {
  DriverReviewDetail,
  DriverReviewSummary,
  DriverStatus,
  PublishTermRequest,
  Term,
} from '../models';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly api = inject(ApiClient);

  /** Review queue, oldest first. The API defaults to PendingReview. */
  drivers(status: DriverStatus): Observable<DriverReviewSummary[]> {
    return this.api.get<DriverReviewSummary[]>('/admin/drivers', { status });
  }

  driver(driverId: string): Observable<DriverReviewDetail> {
    return this.api.get<DriverReviewDetail>(`/admin/drivers/${driverId}`);
  }

  approveDriver(driverId: string): Observable<void> {
    return this.api.post<void>(`/admin/drivers/${driverId}/approve`);
  }

  rejectDriver(driverId: string, reason: string): Observable<void> {
    return this.api.post<void>(`/admin/drivers/${driverId}/reject`, { reason });
  }

  publishTerm(request: PublishTermRequest): Observable<Term> {
    return this.api.post<Term>('/admin/terms', request);
  }
}
