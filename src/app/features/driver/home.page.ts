import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Geolocation } from '@capacitor/geolocation';
import { IonContent, IonIcon, IonRefresher, IonRefresherContent } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { DriverMarketplaceService } from '../../core/api/driver-marketplace.service';
import { DriverService } from '../../core/api/driver.service';
import { SessionService } from '../../core/auth/session.service';
import { DriverDeliverySummary, DriverLocation, Vehicle } from '../../core/models';
import { DELIVERY_STATUS_VIEW, VEHICLE_TYPE_LABEL } from '../../core/ui/labels';
import { completeRefresh } from '../../core/ui/refresher';
import { createRequestState } from '../../core/ui/request-state';
import { sameLocalDay } from '../../core/util/dates';
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
      height: 46dvh;
      min-height: 280px;
      background: var(--black);
    }
    .home-map__off {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      height: 100%;
      padding: 24px;
      text-align: center;
      color: #fff;
    }
    .home-map__off ion-icon {
      font-size: 36px;
      color: var(--red);
    }
    .sheet {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin-top: -28px;
      padding: 22px 16px 140px;
      border-radius: 28px 28px 0 0;
      background: var(--white);
      box-shadow: 0 -10px 30px rgb(0 0 0 / 10%);
    }
    .greet {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .greet h1 {
      margin: 0;
      font: 700 1.6rem/1.1 var(--font-display);
      letter-spacing: -0.02em;
    }
    .plate {
      padding: 6px 10px;
      border-radius: 10px;
      border: 1.5px solid var(--black);
      font: 700 0.85rem/1 var(--font-mono, monospace);
      letter-spacing: 0.06em;
    }
    .ride {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 16px;
      border-radius: 20px;
      background: var(--black);
      color: #fff;
      text-decoration: none;
    }
    .ride .small {
      margin: 0;
      opacity: 0.75;
    }
    .cta {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 18px;
      border-radius: 20px;
      background: var(--red);
      color: #fff;
      font: 700 1.05rem/1 var(--font-display);
      text-decoration: none;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }
    .stat {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 14px 12px;
      border-radius: 18px;
      background: var(--panel, #f3f3f4);
    }
    .stat__value {
      font: 700 1.15rem/1.1 var(--font-display);
      white-space: nowrap;
    }
    .stat__label {
      font-size: 0.75rem;
      color: var(--muted, #6b6b70);
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
            <strong>Ative a localização para ver o mapa</strong>
            <button class="btn btn--sm" type="button" (click)="locate()">Ativar localização</button>
          </div>
        }
      </div>

      <section class="sheet">
        <div class="greet">
          <h1>Olá, {{ firstName() }}</h1>
          @if (vehicle(); as v) {
            <a class="plate" routerLink="/driver/profile" [attr.aria-label]="'Veículo ' + vehicleLabel[v.type]">
              {{ v.plate }}
            </a>
          }
        </div>

        <app-problem-alert [error]="load.error()" />

        @if (underway(); as current) {
          <a class="ride" [routerLink]="['/driver/deliveries', current.deliveryId]">
            <div class="row row--between">
              <strong>Corrida em andamento</strong>
              <app-status-chip [view]="statusView[current.status]" />
            </div>
            <p class="small">{{ current.completedStops }} de {{ current.totalStops }} paradas concluídas</p>
            <span class="link-btn" style="color: #fff">Continuar corrida</span>
          </a>
        } @else {
          <a class="cta" routerLink="/driver/freights">
            <ion-icon name="cube-outline" aria-hidden="true" />
            Ver fretes abertos
          </a>
        }

        <div class="stats">
          <div class="stat">
            <span class="stat__value">{{ earnings() | currency: 'BRL' : 'symbol' : '1.0-0' : 'pt-BR' }}</span>
            <span class="stat__label">Ganhos hoje</span>
          </div>
          <div class="stat">
            <span class="stat__value">{{ today().length }}</span>
            <span class="stat__label">Corridas hoje</span>
          </div>
          <div class="stat">
            <span class="stat__value">{{ total() }}</span>
            <span class="stat__label">Concluídas</span>
          </div>
        </div>
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
  }
}
