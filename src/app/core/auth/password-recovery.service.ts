import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../http/api-client';

/** Password reset requests; the reset token is delivered to the account email by the API. */
@Injectable({ providedIn: 'root' })
export class PasswordRecoveryService {
  private readonly api = inject(ApiClient);

  requestReset(email: string): Observable<void> {
    return this.api.post<void>('/auth/password/forgot', { email });
  }

  resetPassword(token: string, newPassword: string): Observable<void> {
    return this.api.post<void>('/auth/password/reset', { token, newPassword });
  }
}
