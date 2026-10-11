import { Injectable } from '@angular/core';
import { GeoPoint } from '../models';

export interface GeocodeQuery {
  street: string;
  number: string;
  district: string;
  city: string;
  state: string;
  zipCode: string;
}

/**
 * Finds the position of a typed address in Nominatim (OpenStreetMap). The back-end does not geocode, the app does.
 *
 * The public instance is for light use only (max 1 request per second, no bulk, attribution required), so it runs
 * only when the user asks. Plain `fetch` on purpose: the app's HTTP interceptors would attach the session token
 * to a third-party host.
 */
@Injectable({ providedIn: 'root' })
export class GeocodingService {
  private readonly endpoint = 'https://nominatim.openstreetmap.org/search';
  private lastCallAt = 0;

  /** The best match, or `null` when nothing was found. Throws when the service cannot be reached. */
  async locate(query: GeocodeQuery): Promise<GeoPoint | null> {
    const wait = this.lastCallAt + 1100 - Date.now();
    if (wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    this.lastCallAt = Date.now();

    const params = new URLSearchParams({
      format: 'jsonv2',
      limit: '1',
      countrycodes: 'br',
      'accept-language': 'pt-BR',
      street: `${query.number} ${query.street}`.trim(),
      city: query.city,
      state: query.state,
      postalcode: query.zipCode,
    });
    const response = await fetch(`${this.endpoint}?${params.toString()}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) {
      throw new Error(`geocoding_${response.status}`);
    }
    const hits = (await response.json()) as { lat: string; lon: string }[];
    const hit = hits[0];
    if (!hit) {
      return null;
    }
    const latitude = Number(hit.lat);
    const longitude = Number(hit.lon);
    return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
  }
}
