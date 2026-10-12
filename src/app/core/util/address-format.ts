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

/** Full address as one line, for navigation apps when the address has no coordinates. */
function fullAddress(address: Address): string {
  return `${streetLine(address)}, ${areaLine(address)}, ${formatZip(address.zipCode)}, Brasil`;
}

/** Turn-by-turn navigation to the address in Google Maps, from wherever the driver is. */
export function googleMapsNavUrl(address: Address): string {
  const destination =
    typeof address.latitude === 'number' && typeof address.longitude === 'number'
      ? `${address.latitude},${address.longitude}`
      : fullAddress(address);
  return `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${encodeURIComponent(destination)}`;
}

/** Turn-by-turn navigation to the address in Waze. Opens the app when installed, the web page otherwise. */
export function wazeNavUrl(address: Address): string {
  const target =
    typeof address.latitude === 'number' && typeof address.longitude === 'number'
      ? `ll=${address.latitude},${address.longitude}`
      : `q=${encodeURIComponent(fullAddress(address))}`;
  return `https://waze.com/ul?${target}&navigate=yes`;
}
