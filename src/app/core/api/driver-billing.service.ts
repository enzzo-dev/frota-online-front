import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../http/api-client';
import { PayoutAccount, Subscription, SubscriptionOverview, SubscriptionPlan } from '../models';

/** The driver's subscription plan and the account that receives their share of a Pix. */
@Injectable({ providedIn: 'root' })
export class DriverBillingService {
  private readonly api = inject(ApiClient);

  subscription(): Observable<SubscriptionOverview> {
    return this.api.get<SubscriptionOverview>('/driver/subscription');
  }

  subscribe(plan: SubscriptionPlan): Observable<Subscription> {
    return this.api.post<Subscription>('/driver/subscription', { plan });
  }

  cancelSubscription(): Observable<Subscription> {
    return this.api.delete<Subscription>('/driver/subscription');
  }

  payoutAccount(): Observable<PayoutAccount> {
    return this.api.get<PayoutAccount>('/driver/payout-account');
  }

  savePayoutAccount(walletId: string): Observable<PayoutAccount> {
    return this.api.put<PayoutAccount>('/driver/payout-account', { walletId });
  }
}
