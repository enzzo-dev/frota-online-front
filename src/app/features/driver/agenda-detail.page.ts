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
      gap: 12px;
      padding: 20px;
      border-radius: 26px;
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
      font: 700 0.8rem/1 var(--font-mono, monospace);
      letter-spacing: 0.08em;
      text-transform: uppercase;
      opacity: 0.8;
    }
    .when__time {
      font: 700 2.6rem/1 var(--font-display);
      letter-spacing: -0.03em;
    }
    .when__time small {
      font-size: 1.3rem;
      opacity: 0.7;
    }
    .when__meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .pill {
      padding: 6px 10px;
      border-radius: 999px;
      background: rgb(255 255 255 / 12%);
      font-size: 0.78rem;
    }
    .pill--hot {
      background: var(--red);
    }
    .net {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 14px;
      border-radius: 18px;
      background: rgb(255 255 255 / 8%);
    }
    .net__top {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 8px;
    }
    .net__label {
      font-size: 0.75rem;
      opacity: 0.7;
    }
    .net__value {
      display: block;
      font: 700 1.9rem/1.05 var(--font-display);
      letter-spacing: -0.02em;
    }
    .net__gross {
      font-size: 0.8rem;
      opacity: 0.75;
      text-align: right;
    }
    .net__bar {
      display: flex;
      height: 6px;
      border-radius: 3px;
      overflow: hidden;
      background: rgb(255 255 255 / 20%);
    }
    .net__bar span {
      background: var(--red);
    }
    .net__fee {
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
      opacity: 0.7;
    }
    .steps {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .step {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 0.72rem;
      color: var(--muted, #6b6b70);
    }
    .step::before {
      content: '';
      height: 5px;
      border-radius: 3px;
      background: var(--line, #e4e4e7);
    }
    .step--done {
      color: var(--black);
    }
    .step--done::before {
      background: var(--black);
    }
    .step--now {
      font-weight: 700;
      color: var(--black);
    }
    .step--now::before {
      background: var(--red);
    }
    .quick {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }
    .quick__item {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 12px 10px;
      border-radius: 16px;
      background: var(--panel, #f3f3f4);
      min-width: 0;
    }
    .quick__item strong {
      font: 700 1rem/1.1 var(--font-display);
      white-space: nowrap;
    }
    .cap {
      font: 600 0.65rem/1 var(--font-mono, monospace);
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--muted, #6b6b70);
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .head h2 {
      margin: 0;
    }
    .timeline {
      display: flex;
      flex-direction: column;
    }
    .tl {
      display: grid;
      grid-template-columns: 16px 1fr;
      gap: 12px;
    }
    .tl__rail {
      position: relative;
      display: flex;
      justify-content: center;
    }
    .tl__dot {
      width: 12px;
      height: 12px;
      margin-top: 4px;
      border-radius: 50%;
      background: var(--black);
      z-index: 1;
    }
    .tl__dot--to {
      background: var(--red);
    }
    .tl:not(:last-child) .tl__rail::after {
      content: '';
      position: absolute;
      top: 18px;
      bottom: -6px;
      width: 2px;
      background: var(--line, #e4e4e7);
    }
    .tl__body {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding-bottom: 16px;
    }
    .tl__body strong {
      font: 700 1.05rem/1.2 var(--font-display);
    }
    .tl__body .muted {
      font-size: 0.82rem;
    }
    .note {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 12px 14px;
      border-radius: 16px;
      background: var(--panel, #f3f3f4);
      border-left: 4px solid var(--red);
    }
    .note p {
      margin: 0;
      font-size: 0.92rem;
    }
    .photo {
      overflow: hidden;
      border-radius: 18px;
    }
    :host ::ng-deep .photo .photo {
      height: 200px;
      max-height: none;
      border-radius: 0;
    }
    .customer {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .avatar {
      display: grid;
      place-items: center;
      flex: none;
      width: 42px;
      height: 42px;
      border-radius: 50%;
      background: var(--black);
      color: #fff;
      font: 700 1.05rem/1 var(--font-display);
    }
    .customer__plate {
      margin-left: auto;
      padding: 6px 10px;
      border-radius: 8px;
      border: 1.5px solid var(--black);
      font: 700 0.8rem/1 var(--font-mono, monospace);
      letter-spacing: 0.06em;
    }
    .dock {
      position: sticky;
      bottom: 0;
      z-index: 2;
      margin: 0 -16px;
      padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
      background: linear-gradient(to top, var(--white) 70%, transparent);
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
            <div class="when__meta">
              @if (startIso(); as until) {
                @if (d.status === 'Scheduled') {
                  <span class="pill pill--hot">Começa em <app-countdown [until]="until" endedText="agora" /></span>
                }
              }
              @if (window(); as span) {
                <span class="pill">Janela de {{ span }}</span>
              }
            </div>
            <div class="net">
              <div class="net__top">
                <div>
                  <span class="net__label">Você recebe</span>
                  <span class="net__value">{{ net() | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}</span>
                </div>
                <span class="net__gross">de {{ d.agreedPrice | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}</span>
              </div>
              <div class="net__bar" aria-hidden="true"><span [style.width.%]="netShare()"></span></div>
              <div class="net__fee">
                <span>Taxa da plataforma</span>
                <span>{{ feeValue() | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}</span>
              </div>
            </div>
          </section>

          @if (stage() >= 0) {
            <ol class="steps" aria-label="Andamento da corrida">
              @for (step of stepNames; track step; let i = $index) {
                <li class="step" [class.step--done]="i < stage()" [class.step--now]="i === stage()">{{ step }}</li>
              }
            </ol>
          }

          <div class="quick">
            <div class="quick__item">
              <span class="cap">Peso</span>
              <strong>{{ cargo()?.cargoWeightKg ?? d.cargoWeightKg ?? 0 | number: '1.0-2' : 'pt-BR' }} kg</strong>
            </div>
            <div class="quick__item">
              <span class="cap">Paradas</span>
              <strong>{{ d.totalStops }}</strong>
            </div>
          </div>

          <section class="card stack">
            <h2>Rota</h2>
            <div class="timeline">
              <div class="tl">
                <div class="tl__rail"><span class="tl__dot"></span></div>
                <div class="tl__body">
                  <span class="cap">Coleta</span>
                  <strong>{{ origin() }}</strong>
                  @if (originCity(); as city) {
                    <span class="muted">{{ city }}</span>
                  }
                </div>
              </div>
              <div class="tl">
                <div class="tl__rail"><span class="tl__dot tl__dot--to"></span></div>
                <div class="tl__body">
                  <span class="cap">Entrega</span>
                  <strong>{{ destination() }}</strong>
                  @if (destinationCity(); as city) {
                    <span class="muted">{{ city }}</span>
                  }
                </div>
              </div>
            </div>
            <app-route-map-card [route]="map()" [loading]="mapLoading()" [error]="mapError()" />
            @if (stops().length > 1) {
              <app-stops-route [stops]="stops()" />
            }
          </section>

          <section class="card stack">
            <h2>Carga</h2>
            <p class="strong">{{ cargo()?.cargoDescription ?? d.cargoDescription ?? '—' }}</p>
            @if (cargo()?.driverNote; as note) {
              <div class="note" role="note">
                <span class="cap">Recado do cliente</span>
                <p>{{ note }}</p>
              </div>
            }
            @if (cargo()?.hasCargoPhoto) {
              <div class="photo"><app-cargo-photo [freightId]="d.freightRequestId" /></div>
            }
          </section>

          @if (d.customerName || d.vehiclePlate) {
            <section class="card">
              <div class="customer">
                @if (d.customerName; as customer) {
                  <span class="avatar" aria-hidden="true">{{ customer.charAt(0).toUpperCase() }}</span>
                  <div>
                    <span class="cap">Cliente</span>
                    <div class="strong">{{ customer }}</div>
                  </div>
                }
                @if (d.vehiclePlate; as plate) {
                  <span class="customer__plate">{{ plate }}</span>
                }
              </div>
            </section>
          }

          <div class="dock">
            <a class="cta" [routerLink]="['/driver/deliveries', d.deliveryId]">
              {{ d.status === 'Scheduled' ? 'Abrir corrida' : 'Continuar corrida' }}
            </a>
          </div>
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
  protected readonly stepNames = ['Agendada', 'Coleta', 'Em trânsito', 'Entregue'];
  protected readonly stage = computed(() => {
    switch (this.summary()?.status) {
      case 'Scheduled':
        return 0;
      case 'ToPickup':
        return 1;
      case 'PickedUp':
      case 'InTransit':
      case 'Incident':
        return 2;
      case 'Delivered':
        return 3;
      default:
        return -1;
    }
  });
  protected readonly feeValue = computed(() => this.summary()?.platformFee ?? this.fee);
  protected readonly net = computed(() => {
    const d = this.summary();
    return d ? (d.driverNet ?? d.agreedPrice - this.feeValue()) : 0;
  });
  protected readonly netShare = computed(() => {
    const price = this.summary()?.agreedPrice ?? 0;
    return price > 0 ? Math.max(0, Math.min(100, (this.net() / price) * 100)) : 0;
  });
  protected readonly window = computed(() => {
    const from = this.start();
    const to = this.end();
    if (!from || !to) {
      return null;
    }
    return formatDuration((to.getTime() - from.getTime()) / 1000);
  });
  protected readonly originCity = computed(() => (this.summary()?.originDistrict ? this.summary()?.originCity : null));
  protected readonly destinationCity = computed(() =>
    this.summary()?.destinationDistrict ? this.summary()?.destinationCity : null,
  );
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
