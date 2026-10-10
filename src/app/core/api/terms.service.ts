import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../http/api-client';
import { Consent, Term } from '../models';

@Injectable({ providedIn: 'root' })
export class TermsService {
  private readonly api = inject(ApiClient);

  /** Public. Shown before sign-up. */
  active(): Observable<Term[]> {
    return this.api.get<Term[]>('/terms/active');
  }

  /** Active terms the signed-in user has not accepted yet. */
  pending(): Observable<Term[]> {
    return this.api.get<Term[]>('/terms/pending');
  }

  consents(): Observable<Consent[]> {
    return this.api.get<Consent[]>('/terms/consents');
  }

  accept(termDocumentId: string): Observable<Consent> {
    return this.api.post<Consent>('/terms/accept', { termDocumentId });
  }
}
