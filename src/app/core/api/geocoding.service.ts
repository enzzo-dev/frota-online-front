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

const UF_NAMES: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal',
  ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul',
  MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí',
  RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima',
  SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
};

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

    const state = UF_NAMES[query.state.toUpperCase()] ?? query.state;
    const street = `${query.number} ${query.street}`.trim();
    // OSM covers Brazilian postcodes poorly, so a postalcode filter or a bad district empties the result. Try the
    // precise query first, then relax it step by step.
    const attempts: Record<string, string>[] = [
      { street, city: query.city, state },
      { q: `${query.street}, ${query.number}, ${query.district}, ${query.city}, ${state}, Brasil` },
      { q: `${query.street}, ${query.city}, ${state}, Brasil` },
      { q: `${query.zipCode.slice(0, 5)}-${query.zipCode.slice(5)}, ${query.city}, ${state}, Brasil` },
    ];
    for (const [index, attempt] of attempts.entries()) {
      if (index > 0) {
        await new Promise((resolve) => setTimeout(resolve, 1100));
      }
      const point = await this.search(attempt);
      if (point) {
        return point;
      }
    }
    return null;
  }

  private async search(fields: Record<string, string>): Promise<GeoPoint | null> {
    const params = new URLSearchParams({
      format: 'jsonv2',
      limit: '1',
      countrycodes: 'br',
      'accept-language': 'pt-BR',
      ...fields,
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
