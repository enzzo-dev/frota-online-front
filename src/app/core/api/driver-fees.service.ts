import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../http/api-client';
import { FeeCharge, FeeStatement } from '../models';

/** The platform fee a driver owes per delivery. The payment itself never goes through the platform. */
@Injectable({ providedIn: 'root' })
export class DriverFeesService {
  private readonly api = inject(ApiClient);

  statement(): Observable<FeeStatement> {
    return this.api.get<FeeStatement>('/driver/fees');
  }

  /** A Pix for the whole open balance. Paid, the statement is settled by itself. */
  payByPix(): Observable<FeeCharge> {
    return this.api.post<FeeCharge>('/driver/fees/pix');
  }
}
