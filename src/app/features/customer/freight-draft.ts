import { CreateFreightStopRequest, FreightItem, StopType } from '../../core/models';

/** A stop the customer is composing, before the freight is published. */
export interface DraftStop {
  /** Local id, only to track the row while editing. */
  readonly id: string;
  readonly type: StopType;
  readonly addressId: string;
  readonly note: string;
  readonly items: readonly FreightItem[];
}

/**
 * Rules the API enforces on the stops of a freight, checked early so the customer sees them
 * while composing: two or more stops, a pickup first, a delivery last (the final address),
 * and no address used twice.
 */
export function validateStops(stops: readonly DraftStop[]): string[] {
  const problems: string[] = [];
  if (stops.length < 2) {
    problems.push('Adicione pelo menos uma coleta e uma entrega.');
    return problems;
  }
  if (stops[0]?.type !== 'Pickup') {
    problems.push('A primeira parada precisa ser uma coleta.');
  }
  if (stops[stops.length - 1]?.type !== 'Delivery') {
    problems.push('A última parada precisa ser uma entrega: é o endereço final.');
  }
  const ids = stops.map((stop) => stop.addressId);
  if (new Set(ids).size !== ids.length) {
    problems.push('Cada endereço pode aparecer uma vez só.');
  }
  return problems;
}

/** Stops in the shape of the request: the order of the array is the order the driver follows. */
export function toRequestStops(stops: readonly DraftStop[]): CreateFreightStopRequest[] {
  return stops.map((stop) => ({
    type: stop.type,
    addressId: stop.addressId,
    note: stop.note.trim() || null,
    items: stop.items.length > 0 ? stop.items.map((item) => ({ ...item })) : null,
  }));
}

/** Returns a new list with the stop at `index` moved by `delta` positions (clamped). */
export function moveStop(stops: readonly DraftStop[], index: number, delta: -1 | 1): DraftStop[] {
  const target = index + delta;
  if (index < 0 || index >= stops.length || target < 0 || target >= stops.length) {
    return [...stops];
  }
  const next = [...stops];
  const [moved] = next.splice(index, 1);
  if (moved) {
    next.splice(target, 0, moved);
  }
  return next;
}
