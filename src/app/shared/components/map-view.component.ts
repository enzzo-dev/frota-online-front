import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewEncapsulation,
  afterNextRender,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type * as Leaflet from 'leaflet';
import { DriverLocation, GeoPoint, StopType } from '../../core/models';

/** A pin on the map. `sequence` numbers it; `type` colours it (pickup black, delivery red). */
export interface MapPin extends GeoPoint {
  readonly sequence?: number;
  readonly type?: StopType | null;
  readonly label?: string;
}

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>';
/** Radius of the circle that stands for "somewhere around here" on approximate pins. */
const APPROX_RADIUS_M = 1200;
const BRAZIL_CENTER: [number, number] = [-14.2, -51.9];

/**
 * A Leaflet map on OpenStreetMap tiles (no API key). Draws numbered pins, the route path, or, without a path,
 * a straight line between the pins. Leaflet is loaded on first use so screens without a map do not pay for it.
 *
 * - `approximate`: pins are rounded places, drawn with a soft circle instead of an exact needle.
 * - `draggable`: a single pin the user can drag or tap-to-place; emits `pinMoved`.
 */
@Component({
  selector: 'app-map-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `<div #host class="map" role="img" [attr.aria-label]="ariaLabel()"></div>`,
  styles: `
    app-map-view {
      display: block;
      border-radius: var(--r-md, 20px);
      overflow: hidden;
      border: 1px solid var(--line, #e4e4e7);
      background: var(--panel, #f3f3f4);
    }
    app-map-view .map {
      width: 100%;
      height: var(--map-height, 260px);
      z-index: 0;
    }
    app-map-view .leaflet-container {
      font-family: inherit;
    }
    .map-pin {
      display: grid;
      place-items: center;
      width: 30px;
      height: 30px;
      border-radius: 50% 50% 50% 4px;
      transform: rotate(-45deg);
      background: #0b0b0c;
      color: #fff;
      border: 2px solid #fff;
      box-shadow: 0 2px 6px rgb(0 0 0 / 35%);
    }
    .map-pin > span {
      transform: rotate(45deg);
      font: 700 12px/1 'JetBrains Mono Variable', monospace;
    }
    .map-pin--delivery,
    .map-pin--drop {
      background: #d7141a;
    }
    .map-driver {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #1769e0;
      border: 3px solid #fff;
      box-shadow:
        0 0 0 6px rgb(23 105 224 / 25%),
        0 2px 6px rgb(0 0 0 / 35%);
    }
    .map-pin--approx {
      border-radius: 50%;
      transform: none;
      width: 26px;
      height: 26px;
    }
    .map-pin--approx > span {
      transform: none;
    }
  `,
})
export class MapViewComponent implements OnDestroy {
  readonly pins = input<readonly MapPin[]>([]);
  readonly path = input<readonly GeoPoint[]>([]);
  readonly approximate = input(false);
  readonly draggable = input(false);
  /** Where the driver is now, drawn as a vehicle marker that moves without re-fitting the map. */
  readonly driver = input<DriverLocation | null>(null);
  readonly ariaLabel = input('Mapa da rota');
  readonly pinMoved = output<GeoPoint>();

  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');
  private readonly ready = signal(false);

  private lib: typeof Leaflet | null = null;
  private map: Leaflet.Map | null = null;
  private overlay: Leaflet.LayerGroup | null = null;
  private driverLayer: Leaflet.LayerGroup | null = null;
  private driverMarker: Leaflet.Marker | null = null;
  private resizer: ResizeObserver | null = null;
  private fittedKey = '';
  private destroyed = false;

  constructor() {
    afterNextRender(() => {
      void this.create();
    });

    effect(() => {
      const pins = this.pins();
      const path = this.path();
      const approximate = this.approximate();
      const draggable = this.draggable();
      if (!this.ready()) {
        return;
      }
      this.draw(pins, path, approximate, draggable);
    });

    effect(() => {
      const driver = this.driver();
      if (!this.ready()) {
        return;
      }
      this.drawDriver(driver);
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.resizer?.disconnect();
    this.map?.remove();
    this.map = null;
  }

  private async create(): Promise<void> {
    // Leaflet is CommonJS: depending on the bundler the API sits on the namespace or on its `default`.
    const loaded = (await import('leaflet')) as typeof Leaflet & { default?: typeof Leaflet };
    const leaflet = loaded.default ?? loaded;
    if (this.destroyed) {
      return;
    }
    this.lib = leaflet;
    const map = leaflet.map(this.host().nativeElement, {
      center: BRAZIL_CENTER,
      zoom: 4,
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false,
    });
    map.attributionControl.setPrefix(false);
    leaflet.tileLayer(TILE_URL, { maxZoom: 19, attribution: ATTRIBUTION }).addTo(map);
    this.overlay = leaflet.layerGroup().addTo(map);
    this.driverLayer = leaflet.layerGroup().addTo(map);
    this.map = map;

    // Sheets and tabs resize after the first paint; Leaflet must be told.
    this.resizer = new ResizeObserver(() => map.invalidateSize());
    this.resizer.observe(this.host().nativeElement);

    map.on('click', (event: Leaflet.LeafletMouseEvent) => {
      if (this.draggable()) {
        this.pinMoved.emit({ latitude: event.latlng.lat, longitude: event.latlng.lng });
      }
    });
    this.ready.set(true);
  }

  private draw(
    pins: readonly MapPin[],
    path: readonly GeoPoint[],
    approximate: boolean,
    draggable: boolean,
  ): void {
    const L = this.lib;
    const map = this.map;
    const overlay = this.overlay;
    if (!L || !map || !overlay) {
      return;
    }
    overlay.clearLayers();
    const bounds: Leaflet.LatLngExpression[] = [];

    const line = path.length > 1 ? path : pins.length > 1 ? pins : [];
    if (line.length > 1) {
      const drawnRoute = path.length > 1;
      const latlngs = line.map((p): Leaflet.LatLngTuple => [p.latitude, p.longitude]);
      L.polyline(latlngs, {
        color: '#d7141a',
        weight: drawnRoute ? 5 : 3,
        opacity: drawnRoute ? 0.9 : 0.8,
        dashArray: drawnRoute ? undefined : '6 8',
        lineJoin: 'round',
      }).addTo(overlay);
      bounds.push(...latlngs);
    }

    for (const pin of pins) {
      const at: Leaflet.LatLngTuple = [pin.latitude, pin.longitude];
      bounds.push(at);
      if (approximate) {
        L.circle(at, {
          radius: APPROX_RADIUS_M,
          color: '#d7141a',
          weight: 1,
          dashArray: '4 4',
          fillColor: '#d7141a',
          fillOpacity: 0.12,
        }).addTo(overlay);
      }
      const marker = L.marker(at, {
        icon: this.iconFor(L, pin, approximate, draggable),
        draggable,
        keyboard: draggable,
        title: pin.label,
      }).addTo(overlay);
      if (draggable) {
        marker.on('dragend', () => {
          const p = marker.getLatLng();
          // The user moved it: keep their zoom instead of re-fitting around the new spot.
          this.fittedKey = this.keyOf([{ latitude: p.lat, longitude: p.lng }]);
          this.pinMoved.emit({ latitude: p.lat, longitude: p.lng });
        });
      }
    }

    this.fit(map, L, pins, bounds, approximate);
  }

  private drawDriver(driver: DriverLocation | null): void {
    const L = this.lib;
    const layer = this.driverLayer;
    if (!L || !layer) {
      return;
    }
    if (driver === null) {
      layer.clearLayers();
      this.driverMarker = null;
      return;
    }
    const at: Leaflet.LatLngTuple = [driver.latitude, driver.longitude];
    if (this.driverMarker) {
      this.driverMarker.setLatLng(at);
      return;
    }
    this.driverMarker = L.marker(at, {
      icon: L.divIcon({
        className: '',
        html: '<div class="map-driver"></div>',
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      }),
      title: 'Motorista',
      zIndexOffset: 1000,
    }).addTo(layer);
  }

  private fit(
    map: Leaflet.Map,
    L: typeof Leaflet,
    pins: readonly MapPin[],
    bounds: Leaflet.LatLngExpression[],
    approximate: boolean,
  ): void {
    if (bounds.length === 0) {
      return;
    }
    const key = this.keyOf(pins);
    if (key === this.fittedKey) {
      return;
    }
    this.fittedKey = key;
    if (bounds.length === 1) {
      map.setView(bounds[0] as Leaflet.LatLngExpression, approximate ? 13 : 16);
      return;
    }
    map.fitBounds(L.latLngBounds(bounds), { padding: [32, 32], maxZoom: 16 });
  }

  private keyOf(pins: readonly GeoPoint[]): string {
    return pins.map((p) => `${p.latitude.toFixed(5)},${p.longitude.toFixed(5)}`).join('|');
  }

  private iconFor(L: typeof Leaflet, pin: MapPin, approximate: boolean, draggable: boolean): Leaflet.DivIcon {
    const tone = draggable ? 'map-pin--drop' : pin.type === 'Delivery' ? 'map-pin--delivery' : '';
    const shape = approximate ? 'map-pin--approx' : '';
    const content = pin.sequence !== undefined ? String(pin.sequence) : '';
    const size = approximate ? 26 : 30;
    return L.divIcon({
      className: '',
      html: `<div class="map-pin ${tone} ${shape}"><span>${content}</span></div>`,
      iconSize: [size, size],
      iconAnchor: approximate ? [size / 2, size / 2] : [size / 2, size + 2],
    });
  }
}
