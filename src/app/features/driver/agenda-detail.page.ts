import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonContent, IonRefresher, IonRefresherContent } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { DriverMarketplaceService } from '../../core/api/driver-marketplace.service';
import { DeliveryRoute, DriverDeliverySummary, RouteMap } from '../../core/models';
import { ApiError } from '../../core/http/api-error';
import { DELIVERY_STATUS_VIEW } from '../../core/ui/labels';
import { completeRefresh } from '../../core/ui/refresher';
import { createRequestState } from '../../core/ui/request-state';
import { parseUtc } from '../../core/util/dates';
import { PLATFORM_FEE } from '../../core/util/fees';
import { formatDistance, formatDuration } from '../../core/util/route-format';
import { fromRouteStops } from '../../core/util/stop-views';
import { CargoPhotoComponent } from '../../shared/components/cargo-photo.component';
import { CountdownComponent } from '../../shared/components/countdown.component';
import { PageBarComponent } from '../../shared/components/page-bar.component';
import { ProblemAlertComponent } from '../../shared/components/problem-alert.component';
import { RouteMapCardComponent } from '../../shared/components/route-map-card.component';
import { StatusChipComponent } from '../../shared/components/status-chip.component';
import { StopsRouteComponent } from '../../shared/components/stops-route.component';

@Component({
  selector: 'app-agenda-detail-page',
  imports: [
    CurrencyPipe,
    DatePipe,
    DecimalPipe,
    RouterLink,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    CargoPhotoComponent,
    CountdownComponent,
    PageBarComponent,
    ProblemAlertComponent,
    RouteMapCardComponent,
    StatusChipComponent,
    StopsRouteComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .when {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 20px;
      border-radius: 24px;
      background: var(--black);
      color: #fff;
    }
    .when__row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .when__day {
      font: 700 0.85rem/1 var(--font-mono, monospace);
      letter-spacing: 0.08em;
      text-transform: uppercase;
      opacity: 0.8;
    }
    .when__time {
      font: 700 2.4rem/1 var(--font-display);
      letter-spacing: -0.02em;
    }
    .when__count {
      font-size: 0.9rem;
      opacity: 0.85;
    }
    .when__count strong {
      color: #fff;
    }
    .money {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-top: 6px;
    }
    .money div {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 10px 12px;
      border-radius: 14px;
      background: rgb(255 255 255 / 10%);
    }
    .money small {
      opacity: 0.7;
      font-size: 0.72rem;
    }
    .money strong {
      font: 700 1rem/1.1 var(--font-display);
    }
    .legs {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 10px;
    }
    .legs__end {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .legs__end--to {
      text-align: right;
    }
    .legs__mid {
      font: 700 0.8rem/1 var(--font-mono, monospace);
      color: var(--red);
      text-align: center;
    }
    .cap {
      font: 600 0.7rem/1 var(--font-mono, monospace);
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--muted, #6b6b70);
    }
    .facts {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .fact {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .fact strong {
      font-size: 1.05rem;
    }
    .cta {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 18px;
      border-radius: 20px;
      background: var(--red);
      color: #fff;
      font: 700 1.05rem/1 var(--font-display);
      text-decoration: none;
    }
  `,
  template: `
    <app-page-bar title="Agendamento" backHref="/driver/agenda" />

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="page page--wide page--with-bar stack stack--lg">
        <app-problem-alert [error]="load.error()" />

        @if (summary(); as d) {
          <section class="when">
            <div class="when__row">
              <span class="when__day">{{ start() | date: 'EEEE, dd/MM' }}</span>
              <app-status-chip [view]="statusView[d.status]" />
            </div>
            <span class="when__time">
              @if (timed()) {
                {{ start() | date: 'HH:mm' }}@if (end(); as finish) {<small> – {{ finish | date: 'HH:mm' }}</small>}
              } @else {
                Dia todo
              }
            </span>
            @if (startIso(); as until) {
              @if (d.status === 'Scheduled') {
                <span class="when__count">Começa em <strong><app-countdown [until]="until" endedText="agora" /></strong></span>
              }
            }
            <div class="money">
              <div>
                <small>Valor</small>
                <strong>{{ d.agreedPrice | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}</strong>
              </div>
              <div>
                <small>Taxa</small>
                <strong>{{ d.platformFee ?? fee | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}</strong>
              </div>
              <div>
                <small>Você recebe</small>
                <strong>{{ d.driverNet ?? d.agreedPrice - fee | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}</strong>
              </div>
            </div>
          </section>

          <section class="card stack">
            <h2>Carga</h2>
            <p class="strong">{{ cargo()?.cargoDescription ?? d.cargoDescription ?? '—' }}</p>
            <div class="facts">
              <div class="fact">
                <span class="cap">Peso</span>
                <strong>{{ cargo()?.cargoWeightKg ?? d.cargoWeightKg ?? 0 | number: '1.0-2' : 'pt-BR' }} kg</strong>
              </div>
              <div class="fact">
                <span class="cap">Paradas</span>
                <strong>{{ d.totalStops }}</strong>
              </div>
              @if (d.vehiclePlate; as plate) {
                <div class="fact">
                  <span class="cap">Veículo</span>
                  <strong class="mono">{{ plate }}</strong>
                </div>
              }
              @if (d.customerName; as customer) {
                <div class="fact">
                  <span class="cap">Cliente</span>
                  <strong>{{ customer }}</strong>
                </div>
              }
            </div>
            @if (cargo()?.driverNote; as note) {
              <p class="notice small" role="note">{{ note }}</p>
            }
            @if (cargo()?.hasCargoPhoto) {
              <app-cargo-photo [freightId]="d.freightRequestId" />
            }
          </section>

          <section class="card stack">
            <h2>Rota</h2>
            @if (distance(); as km) {
              <div class="legs">
                <div class="legs__end">
                  <span class="cap">Coleta</span>
                  <strong>{{ origin() }}</strong>
                </div>
                <span class="legs__mid">{{ km }}@if (duration(); as time) { · {{ time }}}</span>
                <div class="legs__end legs__end--to">
                  <span class="cap">Entrega</span>
                  <strong>{{ destination() }}</strong>
                </div>
              </div>
            }
            <app-route-map-card [route]="map()" [loading]="mapLoading()" [error]="mapError()" />
            @if (stops().length > 0) {
              <app-stops-route [stops]="stops()" />
            }
          </section>

          <a class="cta" [routerLink]="['/driver/deliveries', d.deliveryId]">
            {{ d.status === 'Scheduled' ? 'Abrir corrida' : 'Continuar corrida' }}
          </a>
        } @else if (load.loading()) {
          <div class="skeleton"></div>
        }
      </div>
    </ion-content>
  `,
})
export class AgendaDetailPage {
  private readonly marketplace = inject(DriverMarketplaceService);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  protected readonly statusView = DELIVERY_STATUS_VIEW;
  protected readonly fee = PLATFORM_FEE;
  protected readonly load = createRequestState();
  protected readonly summary = signal<DriverDeliverySummary | null>(null);
  protected readonly cargo = signal<DeliveryRoute | null>(null);
  protected readonly map = signal<RouteMap | null>(null);
  protected readonly mapLoading = signal(false);
  protected readonly mapError = signal<ApiError | null>(null);

  protected readonly timed = computed(() => {
    const d = this.summary();
    return !!(d?.agendaStartsAt ?? d?.scheduledPickupAt);
  });
  protected readonly startIso = computed(() => {
    const d = this.summary();
    return d ? (d.agendaStartsAt ?? d.scheduledPickupAt ?? d.createdAt) : null;
  });
  protected readonly start = computed(() => {
    const iso = this.startIso();
    return iso ? parseUtc(iso) : null;
  });
  protected readonly end = computed(() => {
    const iso = this.summary()?.agendaEndsAt;
    return iso ? parseUtc(iso) : null;
  });
  protected readonly stops = computed(() => fromRouteStops(this.cargo()?.stops ?? []));
  protected readonly distance = computed(() => formatDistance(this.summary()?.routeDistanceMeters ?? this.map()?.distanceMeters));
  protected readonly duration = computed(() => formatDuration(this.summary()?.routeDurationSeconds ?? this.map()?.durationSeconds));
  protected readonly origin = computed(() => this.place(this.summary()?.originDistrict, this.summary()?.originCity, 'Pickup'));
  protected readonly destination = computed(() =>
    this.place(this.summary()?.destinationDistrict, this.summary()?.destinationCity, 'Delivery'),
  );

  ionViewWillEnter(): void {
    void this.reload();
  }

  protected async refresh(event: Event): Promise<void> {
    await this.reload();
    completeRefresh(event);
  }

  private place(district: string | null | undefined, city: string | null | undefined, type: 'Pickup' | 'Delivery'): string {
    if (district) {
      return district;
    }
    const stops = (this.cargo()?.stops ?? []).filter((stop) => stop.type === type).sort((a, b) => a.sequence - b.sequence);
    const stop = type === 'Pickup' ? stops[0] : stops[stops.length - 1];
    return stop?.address.district ?? city ?? '—';
  }

  private async reload(): Promise<void> {
    const summary = await this.load.run(() => firstValueFrom(this.marketplace.delivery(this.id)));
    if (summary) {
      this.summary.set(summary);
    }
    try {
      this.cargo.set(await firstValueFrom(this.marketplace.route(this.id, 'Full')));
    } catch {
      this.cargo.set(null);
    }
    this.mapLoading.set(true);
    try {
      this.map.set(await firstValueFrom(this.marketplace.routeMap(this.id)));
      this.mapError.set(null);
    } catch (caught) {
      this.mapError.set(ApiError.from(caught));
    } finally {
      this.mapLoading.set(false);
    }
  }
}
