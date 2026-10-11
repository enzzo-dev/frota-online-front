import { StopType } from './enums';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface RoutePreviewRequest {
  /** 2 to 20 addresses of the customer, in the order of the run. */
  addressIds: string[];
}

export interface RouteWaypoint {
  sequence: number;
  /** Null in a preview, where the stop types are not set yet. */
  type: StopType | null;
  label: string;
  latitude: number;
  longitude: number;
}

/**
 * The drawn route. When the routing engine is down, distance and duration are null and `path` is empty:
 * the screen then draws the pins joined by a straight line.
 */
export interface RouteMap {
  distanceMeters: number | null;
  durationSeconds: number | null;
  waypoints: RouteWaypoint[];
  path: GeoPoint[];
}
