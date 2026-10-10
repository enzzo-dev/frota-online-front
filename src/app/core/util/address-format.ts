import { Address } from '../models';

/** `Rua A, 10 - Apto 3` */
export function streetLine(address: Address): string {
  const complement = address.complement ? ` - ${address.complement}` : '';
  return `${address.street}, ${address.number}${complement}`;
}

/** `Centro, São Paulo - SP` */
export function areaLine(address: Pick<Address, 'district' | 'city' | 'state'>): string {
  return `${address.district}, ${address.city} - ${address.state}`;
}

export function formatZip(zip: string): string {
  return zip.length === 8 ? `${zip.slice(0, 5)}-${zip.slice(5)}` : zip;
}

/** A link that opens the address in the maps app. Uses coordinates when the address has them. */
export function mapsUrl(address: Address): string {
  const query =
    typeof address.latitude === 'number' && typeof address.longitude === 'number'
      ? `${address.latitude},${address.longitude}`
      : `${streetLine(address)}, ${areaLine(address)}, ${formatZip(address.zipCode)}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
