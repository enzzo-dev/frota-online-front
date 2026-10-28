import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonRefresher, IonRefresherContent } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { DriverMarketplaceService } from '../../core/api/driver-marketplace.service';
import { DriverService } from '../../core/api/driver.service';
import { DriverDeliverySummary, Vehicle } from '../../core/models';
import { DELIVERY_STATUS_VIEW, VEHICLE_TYPE_LABEL } from '../../core/ui/labels';
import { completeRefresh } from '../../core/ui/refresher';
import { createRequestState } from '../../core/ui/request-state';
import { sameLocalDay } from '../../core/util/dates';
import { HeroComponent } from '../../shared/components/hero.component';
import { ProblemAlertComponent } from '../../shared/components/problem-alert.component';
import { StatusChipComponent } from '../../shared/components/status-chip.component';

const UNDERWAY = ['ToPickup', 'PickedUp', 'InTransit', 'Incident'] as const;

@Component({
  selector: 'app-driver-home-page',
  imports: [
    CurrencyPipe,
    RouterLink,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    HeroComponent,
    ProblemAlertComponent,
    StatusChipComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .stat {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .stat__value {
      font: 700 1.5rem/1.1 var(--font-display);
    }
  `,
  template: `
    <ion-content [fullscreen]="true">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="page page--wide">
        <app-hero title="Início" lede="Seu dia em resumo e o que fazer a seguir." />

        <app-problem-alert [error]="load.error()" />

        @if (underway(); as current) {
          <a class="card card--link stack" [routerLink]="['/driver/deliveries', current.deliveryId]">
            <div class="row row--between">
              <strong>Corrida em andamento</strong>
              <app-status-chip [view]="statusView[current.status]" />
            </div>
            <p class="small">{{ current.completedStops }} de {{ current.totalStops }} paradas concluídas</p>
            <span class="link-btn">Continuar corrida</span>
          </a>
        } @else {
          <a class="card card--link row row--between" routerLink="/driver/freights">
            <div>
              <strong>Nenhuma corrida em andamento</strong>
              <p class="muted small">Veja os fretes abertos e envie sua proposta.</p>
            </div>
            <span class="link-btn">Ver fretes</span>
          </a>
        }

        <div class="stats">
          <div class="card stat">
            <span class="muted small">Ganhos hoje</span>
            <span class="stat__value">{{ earnings() | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}</span>
          </div>
          <div class="card stat">
            <span class="muted small">Corridas hoje</span>
            <span class="stat__value">{{ today().length }}</span>
          </div>
          <div class="card stat">
            <span class="muted small">Concluídas no total</span>
            <span class="stat__value">{{ total() }}</span>
          </div>
          <a class="card card--link stat" routerLink="/driver/profile">
            <span class="muted small">Veículo ativo</span>
            @if (vehicle(); as v) {
              <span class="stat__value">{{ vehicleLabel[v.type] }}</span>
              <span class="muted small mono">{{ v.plate }}</span>
            } @else {
              <span class="stat__value">—</span>
              <span class="muted small">Cadastre um veículo</span>
            }
          </a>
        </div>
      </div>
    </ion-content>
  `,
})
export class DriverHomePage {
  private readonly marketplace = inject(DriverMarketplaceService);
  private readonly driver = inject(DriverService);

  protected readonly statusView = DELIVERY_STATUS_VIEW;
  protected readonly vehicleLabel = VEHICLE_TYPE_LABEL;
  protected readonly load = createRequestState();

  private readonly deliveries = signal<readonly DriverDeliverySummary[]>([]);
  private readonly vehicles = signal<readonly Vehicle[]>([]);

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
  }

  protected async refresh(event: Event): Promise<void> {
    await this.reload();
    completeRefresh(event);
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
