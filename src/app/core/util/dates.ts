const HAS_ZONE = /(Z|[+-]\d{2}:?\d{2})$/i;

/**
 * The API stores UTC. A timestamp without a zone designator would be read as local time by
 * `new Date()`, so a missing zone is treated as UTC.
 */
export function parseUtc(value: string): Date {
  return new Date(HAS_ZONE.test(value) ? value : `${value}Z`);
}

export function toUtcMillis(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const time = parseUtc(value).getTime();
  return Number.isNaN(time) ? null : time;
}

/** Converts the value of an `<input type="datetime-local">` (local time) to a UTC ISO string ending in Z. */
export function localInputToUtcIso(localValue: string): string {
  return new Date(localValue).toISOString();
}
