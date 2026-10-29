import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Geolocation } from '@capacitor/geolocation';
import { IonContent, IonIcon, IonRefresher, IonRefresherContent } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { DriverMarketplaceService } from '../../core/api/driver-marketplace.service';
import { DriverService } from '../../core/api/driver.service';
import { SessionService } from '../../core/auth/session.service';
import { DriverDeliverySummary, DriverLocation, OpenFreight, Proposal, Vehicle } from '../../core/models';
import { DELIVERY_STATUS_VIEW, VEHICLE_TYPE_LABEL } from '../../core/ui/labels';
import { completeRefresh } from '../../core/ui/refresher';
import { createRequestState } from '../../core/ui/request-state';
import { sameLocalDay, toUtcMillis } from '../../core/util/dates';
import { formatDistance } from '../../core/util/route-format';
import { CountdownComponent } from '../../shared/components/countdown.component';
import { MapViewComponent } from '../../shared/components/map-view.component';
import { ProblemAlertComponent } from '../../shared/components/problem-alert.component';
import { StatusChipComponent } from '../../shared/components/status-chip.component';

const UNDERWAY = ['ToPickup', 'PickedUp', 'InTransit', 'Incident'] as const;

@Component({
  selector: 'app-driver-home-page',
  imports: [
    CurrencyPipe,
    RouterLink,
    IonContent,
    IonIcon,
    IonRefresher,
    IonRefresherContent,
    CountdownComponent,
    MapViewComponent,
    ProblemAlertComponent,
    StatusChipComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host ::ng-deep .home-map app-map-view {
      --map-height: 100%;
      height: 100%;
      border: 0;
      border-radius: 0;
    }
    .home-map {
      position: relative;
      height: 36dvh;
      min-height: 220px;
      background: var(--black);
    }
    .home-map__off {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      height: 100%;
      padding: 24px;
      text-align: center;
      color: #fff;
      font-size: 0.9rem;
    }
    .home-map__off ion-icon {
      font-size: 30px;
      color: var(--red);
    }
    .sheet {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      gap: 20px;
      margin-top: -24px;
      padding: 10px 16px 140px;
      border-radius: 24px 24px 0 0;
      background: var(--white);
      box-shadow: 0 -8px 24px rgb(0 0 0 / 8%);
    }
    .grabber {
      align-self: center;
      width: 36px;
      height: 4px;
      border-radius: 2px;
      background: var(--line, #e4e4e7);
    }
    .greet {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .greet__hi {
      display: block;
      font-size: 0.8rem;
      color: var(--muted, #6b6b70);
    }
    .greet h1 {
      margin: 0;
      font: 700 1.35rem/1.15 var(--font-display);
      letter-spacing: -0.02em;
    }
    .plate {
      padding: 6px 10px;
      border-radius: 8px;
      border: 1.5px solid var(--black);
      color: inherit;
      text-decoration: none;
      font: 700 0.8rem/1 var(--font-mono, monospace);
      letter-spacing: 0.06em;
    }
    .summary {
      display: grid;
      grid-template-columns: 1.4fr 1fr 1fr;
      align-items: end;
      gap: 12px;
      padding: 14px 16px;
      border-radius: 18px;
      background: var(--panel, #f3f3f4);
    }
    .summary__cell {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .summary__cell + .summary__cell {
      padding-left: 12px;
      border-left: 1px solid var(--line, #e4e4e7);
    }
    .summary__value {
      font: 700 1.1rem/1.1 var(--font-display);
      white-space: nowrap;
    }
    .summary__cell--main .summary__value {
      font-size: 1.6rem;
      letter-spacing: -0.02em;
    }
    .summary__label {
      font-size: 0.7rem;
      color: var(--muted, #6b6b70);
    }
    .ride {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 14px 16px;
      border-radius: 18px;
      background: var(--black);
      color: #fff;
      text-decoration: none;
    }
    .ride .small {
      margin: 0;
      opacity: 0.7;
    }
    .ride__progress {
      height: 4px;
      border-radius: 2px;
      background: rgb(255 255 255 / 20%);
      overflow: hidden;
    }
    .ride__progress span {
      display: block;
      height: 100%;
      background: var(--red);
    }
    .cta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 16px;
      border-radius: 18px;
      background: var(--red);
      color: #fff;
      text-decoration: none;
    }
    .cta strong {
      display: block;
      font: 700 1rem/1.2 var(--font-display);
    }
    .cta span {
      font-size: 0.8rem;
      opacity: 0.85;
    }
    .group {
      display: flex;
      flex-direction: column;
    }
    .group__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 6px;
    }
    .group__head h2 {
      margin: 0;
      font: 700 0.75rem/1 var(--font-display);
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--muted, #6b6b70);
    }
    .group__head a {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--red);
      text-decoration: none;
    }
    .row-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 0;
      border-top: 1px solid var(--line, #e4e4e7);
      color: inherit;
      text-decoration: none;
    }
    .row-item__icon {
      display: grid;
      place-items: center;
      flex: none;
      width: 38px;
      height: 38px;
      border-radius: 12px;
      background: var(--panel, #f3f3f4);
      font-size: 18px;
    }
    .row-item__body {
      flex: 1;
      min-width: 0;
    }
    .row-item__title {
      overflow: hidden;
      font: 600 0.95rem/1.25 var(--font-display);
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .row-item__meta {
      font-size: 0.78rem;
      color: var(--muted, #6b6b70);
    }
    .row-item__end {
      flex: none;
      text-align: right;
      font-size: 0.75rem;
      color: var(--muted, #6b6b70);
    }
    .row-item__end strong {
      display: block;
      font: 700 1rem/1.2 var(--font-display);
      color: var(--black);
    }
  `,
  template: `
    <ion-content [fullscreen]="true">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="home-map">
        @if (position(); as here) {
          <app-map-view [driver]="here" [centerOnDriver]="true" ariaLabel="Sua posição no mapa" />
        } @else {
          <div class="home-map__off">
            <ion-icon name="location-outline" aria-hidden="true" />
            <span>Ative a localização para ver o mapa</span>
            <button class="btn btn--sm" type="button" (click)="locate()">Ativar localização</button>
          </div>
        }
      </div>

      <section class="sheet">
        <span class="grabber" aria-hidden="true"></span>

        <div class="greet">
          <div>
            <span class="greet__hi">Olá,</span>
            <h1>{{ firstName() }}</h1>
          </div>
          @if (vehicle(); as v) {
            <a class="plate" routerLink="/driver/profile" [attr.aria-label]="'Veículo ' + vehicleLabel[v.type]">
              {{ v.plate }}
            </a>
          }
        </div>

        <app-problem-alert [error]="load.error()" />

        <div class="summary">
          <div class="summary__cell summary__cell--main">
            <span class="summary__value">{{ earnings() | currency: 'BRL' : 'symbol' : '1.0-0' : 'pt-BR' }}</span>
            <span class="summary__label">Ganhos hoje</span>
          </div>
          <div class="summary__cell">
            <span class="summary__value">{{ today().length }}</span>
            <span class="summary__label">Hoje</span>
          </div>
          <div class="summary__cell">
            <span class="summary__value">{{ total() }}</span>
            <span class="summary__label">Concluídas</span>
          </div>
        </div>

        @if (underway(); as current) {
          <a class="ride" [routerLink]="['/driver/deliveries', current.deliveryId]">
            <div class="row row--between">
              <strong>Corrida em andamento</strong>
              <app-status-chip [view]="statusView[current.status]" />
            </div>
            <p class="small">{{ current.completedStops }} de {{ current.totalStops }} paradas concluídas</p>
            <div class="ride__progress" aria-hidden="true">
              <span [style.width.%]="progress(current)"></span>
            </div>
          </a>
        } @else {
          <a class="cta" routerLink="/driver/freights">
            <div>
              <strong>Ver fretes abertos</strong>
              <span>{{ openCount() === 0 ? 'Nenhum frete no momento' : openCount() + ' esperando proposta' }}</span>
            </div>
            <ion-icon name="chevron-forward-outline" aria-hidden="true" />
          </a>
        }

        @if (openFreights().length > 0) {
          <div class="group">
            <div class="group__head">
              <h2>Fretes abertos</h2>
              <a routerLink="/driver/freights">Ver todos</a>
            </div>
            @for (freight of openFreights(); track freight.id) {
              <a class="row-item" routerLink="/driver/freights">
                <span class="row-item__icon"><ion-icon name="cube-outline" aria-hidden="true" /></span>
                <div class="row-item__body">
                  <div class="row-item__title">{{ freight.cargoDescription }}</div>
                  <div class="row-item__meta">
                    {{ freight.cargoWeightKg }} kg
                    @if (distance(freight); as km) {
                      · {{ km }}
                    }
                    · {{ freight.pickupCount + freight.deliveryCount }} paradas
                  </div>
                </div>
                <div class="row-item__end">
                  fecha em
                  <strong><app-countdown [until]="freight.proposalDeadline" /></strong>
                </div>
              </a>
            }
          </div>
        }

        @if (pending().length > 0) {
          <div class="group">
            <div class="group__head">
              <h2>Propostas pendentes</h2>
              <a routerLink="/driver/proposals">Ver todas</a>
            </div>
            @for (proposal of pending(); track proposal.id) {
              <a class="row-item" routerLink="/driver/proposals">
                <span class="row-item__icon"><ion-icon name="time-outline" aria-hidden="true" /></span>
                <div class="row-item__body">
                  <div class="row-item__title">Frete #{{ shortId(proposal.freightRequestId) }}</div>
                  <div class="row-item__meta">Aguardando resposta do cliente</div>
                </div>
                <div class="row-item__end">
                  expira em
                  <strong><app-countdown [until]="proposal.expiresAt" /></strong>
                </div>
              </a>
            }
          </div>
        }
      </section>
    </ion-content>
  `,
})
export class DriverHomePage {
  private readonly marketplace = inject(DriverMarketplaceService);
  private readonly driver = inject(DriverService);
  private readonly session = inject(SessionService);

  protected readonly statusView = DELIVERY_STATUS_VIEW;
  protected readonly vehicleLabel = VEHICLE_TYPE_LABEL;
  protected readonly load = createRequestState();
  protected readonly position = signal<DriverLocation | null>(null);

  private readonly deliveries = signal<readonly DriverDeliverySummary[]>([]);
  private readonly vehicles = signal<readonly Vehicle[]>([]);
  private readonly proposals = signal<readonly Proposal[]>([]);
  private readonly open = signal<readonly OpenFreight[]>([]);

  protected readonly openFreights = computed(() =>
    [...this.open()]
      .sort((a, b) => (toUtcMillis(a.proposalDeadline) ?? 0) - (toUtcMillis(b.proposalDeadline) ?? 0))
      .slice(0, 3),
  );

  protected readonly pending = computed(() =>
    this.proposals()
      .filter((proposal) => proposal.status === 'Pending')
      .slice(0, 3),
  );

  protected readonly firstName = computed(() => (this.session.user()?.fullName ?? '').split(' ')[0] || 'motorista');
  protected readonly underway = computed(
    () => this.deliveries().find((delivery) => (UNDERWAY as readonly string[]).includes(delivery.status)) ?? null,
  );
  protected readonly today = computed(() =>
    this.deliveries().filter(
      (delivery) => delivery.status === 'Delivered' && sameLocalDay(delivery.deliveredAt ?? delivery.createdAt, new Date()),
    ),
  );
  protected readonly earnings = computed(() => this.today().reduce((sum, delivery) => sum + delivery.agreedPrice, 0));
  protected readonly total = computed(() => this.deliveries().filter((delivery) => delivery.status === 'Delivered').length);
  protected readonly vehicle = computed(() => this.vehicles().find((item) => item.isActive) ?? null);

  ionViewWillEnter(): void {
    void this.reload();
    void this.locate();
  }

  protected async refresh(event: Event): Promise<void> {
    await this.reload();
    completeRefresh(event);
  }

  protected async locate(): Promise<void> {
    try {
      const permission = await Geolocation.requestPermissions({ permissions: ['location'] }).catch(() => null);
      if (permission && permission.location !== 'granted') {
        return;
      }
      const fix = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10_000 });
      this.position.set({
        latitude: fix.coords.latitude,
        longitude: fix.coords.longitude,
        heading: null,
        speedKmh: null,
        recordedAt: new Date().toISOString(),
      });
    } catch {
      this.position.set(null);
    }
  }

  protected openCount(): number {
    return this.open().length;
  }

  protected progress(delivery: DriverDeliverySummary): number {
    return delivery.totalStops > 0 ? Math.round((delivery.completedStops / delivery.totalStops) * 100) : 0;
  }

  protected distance(freight: OpenFreight): string {
    return formatDistance(freight.routeDistanceMeters) ?? '';
  }

  protected shortId(id: string): string {
    return id.slice(0, 8);
  }

  private async reload(): Promise<void> {
    const list = await this.load.run(() => firstValueFrom(this.marketplace.deliveries()));
    if (list) {
      this.deliveries.set(list);
    }
    try {
      this.vehicles.set(await firstValueFrom(this.driver.vehicles()));
    } catch {
      this.vehicles.set([]);
    }
    try {
      this.open.set(await firstValueFrom(this.marketplace.openFreights()));
    } catch {
      this.open.set([]);
    }
    try {
      this.proposals.set(await firstValueFrom(this.marketplace.proposals()));
    } catch {
      this.proposals.set([]);
    }
  }
}
