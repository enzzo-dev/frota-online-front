import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../http/api-client';
import { SavedCard } from '../models';

/** Cards a customer chose to keep: brand and last four digits only, the provider holds the token. */
@Injectable({ providedIn: 'root' })
export class CustomerCardsService {
  private readonly api = inject(ApiClient);

  list(): Observable<SavedCard[]> {
    return this.api.get<SavedCard[]>('/customer/cards');
  }

  remove(cardId: string): Observable<void> {
    return this.api.delete<void>(`/customer/cards/${cardId}`);
  }
}
