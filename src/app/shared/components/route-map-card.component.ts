import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IonIcon, IonSpinner } from '@ionic/angular';
import { ApiError } from '../../core/http/api-error';
import { RouteMap } from '../../core/models';
import { formatDistance, formatDuration } from '../../core/util/route-format';
import { MapPin, MapViewComponent } from './map-view.component';

/**
 * Distance, estimated time and map of a route. Presentational: the screen loads the route and passes it in.
 * When the routing engine is down the numbers are null and the path is empty: the pins are joined by a dashed
 * straight line and a short note says so. That is not an error.
 */
@Component({
  selector: 'app-route-map-card',
  imports: [IonIcon, IonSpinner, MapViewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="card stack" aria-label="Prévia da rota">
      @if (route(); as r) {
        <div class="stats stats--2">
          <div class="stat">
            <span class="stat__label">Distância</span>
            <strong class="stat__num">{{ distance() ?? '—' }}</strong>
          </div>
          <div class="stat">
            <span class="stat__label">Tempo estimado</span>
            <strong class="stat__num">{{ duration() ?? '—' }}</strong>
          </div>
        </div>

        <app-map-view [pins]="pins()" [path]="r.path" ariaLabel="Mapa da rota com as paradas" />

        @if (straightLine()) {
          <p class="field-hint">
            Não conseguimos calcular o trajeto agora. Mostramos a linha reta entre as paradas; distância e tempo
            ficam em branco, e isso não impede o pedido.
          </p>
        }
      } @else if (loading()) {
        <div class="route-card__loading" role="status">
          <ion-spinner name="crescent" /> Calculando a rota...
        </div>
      }

      @if (missing().length > 0) {
        <div class="notice notice--error" role="alert">
          <p><strong>Estes endereços ainda não têm posição no mapa:</strong></p>
          <ul>
            @for (label of missing(); track label) {
              <li>{{ label }}</li>
            }
          </ul>
          <p class="small">
            Edite o endereço em Endereços e use "Localizar no mapa". Se ele já foi usado em um frete, salve como um
            novo endereço e escolha o novo aqui.
          </p>
        </div>
      } @else if (error(); as problem) {
        <div class="notice notice--error" role="alert">
          <ion-icon name="alert-circle-outline" aria-hidden="true" /> {{ problem.message }}
        </div>
      }
    </section>
  `,
  styles: `
    .route-card__loading {
      display: flex;
      align-items: center;
      gap: 10px;
      color: var(--ink-soft);
    }
    .route-card__loading ion-spinner {
      width: 18px;
      height: 18px;
    }
  `,
})
export class RouteMapCardComponent {
  readonly route = input<RouteMap | null>(null);
  readonly loading = input(false);
  readonly error = input<ApiError | null>(null);
  /** Labels of the addresses that have no position, found before or after asking the API. */
  readonly missing = input<readonly string[]>([]);

  protected readonly distance = computed(() => formatDistance(this.route()?.distanceMeters));
  protected readonly duration = computed(() => formatDuration(this.route()?.durationSeconds));
  protected readonly straightLine = computed(() => {
    const r = this.route();
    return r !== null && r.path.length < 2;
  });
  protected readonly pins = computed<MapPin[]>(() =>
    (this.route()?.waypoints ?? []).map((w) => ({
      latitude: w.latitude,
      longitude: w.longitude,
      sequence: w.sequence,
      type: w.type,
      label: w.label,
    })),
  );
}
