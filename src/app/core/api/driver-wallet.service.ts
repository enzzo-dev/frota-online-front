import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../http/api-client';
import { WalletAccount, WalletAuthorization } from '../models';

/** The driver's Mercado Pago connection, needed for customers to pay them with Apple Pay. */
@Injectable({ providedIn: 'root' })
export class DriverWalletService {
  private readonly api = inject(ApiClient);

  get(): Observable<WalletAccount> {
    return this.api.get<WalletAccount>('/driver/wallet-account');
  }

  /** Valid for 15 minutes: open `authorizationUrl` in the browser. */
  startAuthorization(): Observable<WalletAuthorization> {
    return this.api.post<WalletAuthorization>('/driver/wallet-account/authorization', {});
  }

  disconnect(): Observable<WalletAccount> {
    return this.api.delete<WalletAccount>('/driver/wallet-account');
  }
}
