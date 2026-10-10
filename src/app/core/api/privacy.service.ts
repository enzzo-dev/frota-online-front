import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../http/api-client';
import { AccountDeletionResponse, DeleteAccountRequest, PersonalDataExport } from '../models';

/** The rights of the data subject (LGPD art. 18): see the data held, and have it erased. */
@Injectable({ providedIn: 'root' })
export class PrivacyService {
  private readonly api = inject(ApiClient);

  exportData(): Observable<PersonalDataExport> {
    return this.api.get<PersonalDataExport>('/me/data');
  }

  deleteAccount(request: DeleteAccountRequest): Observable<AccountDeletionResponse> {
    return this.api.post<AccountDeletionResponse>('/me/deletion', request);
  }
}
