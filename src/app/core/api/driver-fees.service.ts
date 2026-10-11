import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../http/api-client';
import { FeeStatement } from '../models';

/** The platform fee a driver owes per delivery. The payment itself never goes through the platform. */
@Injectable({ providedIn: 'root' })
export class DriverFeesService {
  private readonly api = inject(ApiClient);

  statement(): Observable<FeeStatement> {
    return this.api.get<FeeStatement>('/driver/fees');
  }
}
