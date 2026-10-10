import { FreightItem, FreightStop, OpenStop, RouteStop, StopType } from '../models';
import { areaLine, formatZip, mapsUrl, streetLine } from './address-format';

/** One stop of a route, in the shape the route component draws. */
export interface StopView {
  readonly sequence: number;
  readonly type: StopType;
  readonly title: string;
  readonly subtitle?: string;
  readonly note?: string | null;
  readonly items: readonly FreightItem[];
  readonly done: boolean;
  readonly mapsLink?: string;
}

/** Stops of the customer's own freight: full addresses. */
export function fromFreightStops(stops: readonly FreightStop[]): StopView[] {
  return [...stops]
    .sort((a, b) => a.sequence - b.sequence)
    .map((stop) => ({
      sequence: stop.sequence,
      type: stop.type,
      title: `${stop.address.label} · ${streetLine(stop.address)}`,
      subtitle: `${areaLine(stop.address)} · ${formatZip(stop.address.zipCode)}`,
      note: stop.note,
      items: stop.items,
      done: stop.completedAt !== null,
    }));
}

/** Stops of an open freight, as a driver sees them before winning: area only, no street. */
export function fromOpenStops(stops: readonly OpenStop[]): StopView[] {
  return [...stops]
    .sort((a, b) => a.sequence - b.sequence)
    .map((stop) => ({
      sequence: stop.sequence,
      type: stop.type,
      title: `${stop.district}, ${stop.city} - ${stop.state}`,
      items: stop.items,
      done: false,
    }));
}

/** Stops of a delivery the driver won: full address and a maps link. */
export function fromRouteStops(stops: readonly RouteStop[]): StopView[] {
  return [...stops]
    .sort((a, b) => a.sequence - b.sequence)
    .map((stop) => ({
      sequence: stop.sequence,
      type: stop.type,
      title: streetLine(stop.address),
      subtitle: `${areaLine(stop.address)} · ${formatZip(stop.address.zipCode)}`,
      note: stop.note,
      items: stop.items,
      done: stop.completedAt !== null,
      mapsLink: mapsUrl(stop.address),
    }));
}
