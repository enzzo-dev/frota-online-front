import { Injectable } from '@angular/core';

export interface ZipAddress {
  street: string;
  district: string;
  city: string;
  state: string;
}

/**
 * Finds the street, district, city and state of a CEP in ViaCEP (public, free, no key). The back-end does not do this.
 * Plain `fetch` on purpose: the app's HTTP interceptors would attach the session token to a third-party host.
 */
@Injectable({ providedIn: 'root' })
export class ZipLookupService {
  private readonly endpoint = 'https://viacep.com.br/ws';

  /**
   * The address of the CEP, or `null` when it does not exist. Fields the CEP does not carry (a city with a single
   * CEP has no street) come back empty. Throws when the service cannot be reached.
   */
  async lookup(zipCode: string): Promise<ZipAddress | null> {
    const response = await fetch(`${this.endpoint}/${zipCode}/json/`, { headers: { Accept: 'application/json' } });
    if (!response.ok) {
      // ViaCEP answers 400 for a malformed CEP: that is "not found" for the user.
      if (response.status === 400) {
        return null;
      }
      throw new Error(`zip_lookup_${response.status}`);
    }
    const body = (await response.json()) as {
      erro?: boolean | string;
      logradouro?: string;
      bairro?: string;
      localidade?: string;
      uf?: string;
    };
    if (body.erro) {
      return null;
    }
    return {
      street: body.logradouro ?? '',
      district: body.bairro ?? '',
      city: body.localidade ?? '',
      state: body.uf ?? '',
    };
  }
}
