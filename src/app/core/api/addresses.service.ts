import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from '../http/api-client';
import { Address, CreateAddressRequest } from '../models';

@Injectable({ providedIn: 'root' })
export class AddressesService {
  private readonly api = inject(ApiClient);

  list(): Observable<Address[]> {
    return this.api.get<Address[]>('/addresses');
  }

  create(request: CreateAddressRequest): Observable<Address> {
    return this.api.post<Address>('/addresses', request);
  }

  /** Replaces every field. Send the position again (both coordinates) or it is cleared. */
  update(addressId: string, request: CreateAddressRequest): Observable<Address> {
    return this.api.put<Address>(`/addresses/${addressId}`, request);
  }

  delete(addressId: string): Observable<void> {
    return this.api.delete<void>(`/addresses/${addressId}`);
  }
}
