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
}
