import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonContent,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  IonSegment,
  IonSegmentButton,
} from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { FreightsService } from '../../core/api/freights.service';
import { Freight, FreightStatus } from '../../core/models';
import { FREIGHT_STATUS_VIEW, VEHICLE_TYPE_LABEL } from '../../core/ui/labels';
import { completeRefresh } from '../../core/ui/refresher';
import { createRequestState } from '../../core/ui/request-state';
import { Poller } from '../../core/util/poller';
import { formatDistance, formatDuration } from '../../core/util/route-format';
import { CountdownComponent } from '../../shared/components/countdown.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { HeroComponent } from '../../shared/components/hero.component';
import { ProblemAlertComponent } from '../../shared/components/problem-alert.component';
import { StatusChipComponent } from '../../shared/components/status-chip.component';
import { UtcPipe } from '../../shared/pipes/utc.pipe';

type Filter = 'all' | FreightStatus;

const POLL_MS = 20_000;

/** The customer's freights, newest first, filtered by status. */
@Component({
  selector: 'app-freights-page',
  imports: [
    DatePipe,
    DecimalPipe,
    RouterLink,
    IonContent,
    IonIcon,
    IonRefresher,
    IonRefresherContent,
    IonSegment,
    IonSegmentButton,
    CountdownComponent,
    EmptyStateComponent,
    HeroComponent,
    ProblemAlertComponent,
    StatusChipComponent,
    UtcPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-content [fullscreen]="true">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="page page--wide">
        <app-hero
          title="Seus fretes"
          lede="Peça um frete, compare os preços dos motoristas e aprove o melhor."
        >
          <a class="btn btn--on-dark" routerLink="/customer/freights/new">
            <ion-icon name="add-outline" aria-hidden="true" />
            Pedir novo frete
          </a>
        </app-hero>

        @if (all().length > 0) {
          <div class="stats">
            <div class="stat"><span class="stat__num stat__num--red">{{ counts().open }}</span><span class="stat__label">Aguardando propostas</span></div>
            <div class="stat"><span class="stat__num">{{ counts().proposals }}</span><span class="stat__label">Propostas recebidas</span></div>
            <div class="stat"><span class="stat__num">{{ counts().approved }}</span><span class="stat__label">Fretes aprovados</span></div>
          </div>
        }

        <ion-segment [value]="filter()" (ionChange)="onFilter($event.detail.value)">
          <ion-segment-button value="all">Todos</ion-segment-button>
          <ion-segment-button value="Open">Abertos</ion-segment-button>
          <ion-segment-button value="Approved">Aprovados</ion-segment-button>
          <ion-segment-button value="Expired">Expirados</ion-segment-button>
          <ion-segment-button value="Cancelled">Cancelados</ion-segment-button>
        </ion-segment>

        <app-problem-alert [error]="load.error()" />

        @if (visible(); as list) {
          @if (list.length === 0 && !load.loading()) {
            <app-empty-state
              title="Nenhum frete aqui"
              description="Cadastre seus endereços e publique o primeiro frete."
            >
              <a class="btn btn--sm" routerLink="/customer/freights/new">Novo frete</a>
            </app-empty-state>
          }

          <div class="grid-cards">
            @for (freight of list; track freight.id) {
              <a class="card card--link stack" [routerLink]="['/customer/freights', freight.id]">
                <div class="row row--between row--wrap">
                  <h3 class="grow break">{{ freight.cargoDescription }}</h3>
                  <app-status-chip [view]="statusView[freight.status]" />
                </div>
                <p class="muted small">
                  {{ typeLabel[freight.requiredVehicleType] }} ·
                  {{ freight.cargoWeightKg | number: '1.0-2' : 'pt-BR' }} kg ·
                  {{ freight.pickupCount }} {{ freight.pickupCount === 1 ? 'coleta' : 'coletas' }} ·
                  {{ freight.deliveryCount }} {{ freight.deliveryCount === 1 ? 'entrega' : 'entregas' }}
                </p>
                @if (distanceOf(freight); as distance) {
                  <p class="small">
                    <ion-icon name="navigate-outline" aria-hidden="true" /> {{ distance }}
                    @if (durationOf(freight); as time) {
                      · {{ time }}
                    }
                  </p>
                }
                <p class="small">
                  @if (freight.scheduledPickupAt; as when) {
                    Coleta em <strong>{{ when | utc | date: "dd/MM 'às' HH:mm" }}</strong>
                  } @else {
                    <strong>Coleta hoje</strong>
                  }
                </p>
                @if (freight.status === 'Open') {
                  <p class="small">
                    <strong>{{ freight.pendingProposals }}</strong>
                    {{ freight.pendingProposals === 1 ? 'proposta' : 'propostas' }} · janela termina em
                    <app-countdown [until]="freight.proposalDeadline" />
                  </p>
                }
              </a>
            }
          </div>
        } @else if (load.loading()) {
          <div class="skeleton"></div>
          <div class="skeleton"></div>
        }
      </div>

      <a class="btn fab-new" routerLink="/customer/freights/new" aria-label="Pedir novo frete">
        <ion-icon name="add-outline" aria-hidden="true" /> Novo frete
      </a>
    </ion-content>
  `,
})
export class FreightsPage {
  protected readonly distanceOf = (freight: Freight) => formatDistance(freight.routeDistanceMeters);
  protected readonly durationOf = (freight: Freight) => formatDuration(freight.routeDurationSeconds);

  private readonly freightsApi = inject(FreightsService);

  protected readonly statusView = FREIGHT_STATUS_VIEW;
  protected readonly typeLabel = VEHICLE_TYPE_LABEL;
  protected readonly load = createRequestState();
  protected readonly filter = signal<Filter>('all');

  private readonly freights = signal<Freight[] | null>(null);

  protected readonly all = computed(() => this.freights() ?? []);

  protected readonly counts = computed(() => {
    const list = this.all();
    return {
      open: list.filter((freight) => freight.status === 'Open').length,
      proposals: list.filter((freight) => freight.status === 'Open').reduce((sum, freight) => sum + freight.pendingProposals, 0),
      approved: list.filter((freight) => freight.status === 'Approved').length,
    };
  });

  protected readonly visible = computed(() => {
    const all = this.freights();
    if (all === null) {
      return null;
    }
    const filter = this.filter();
    return [...all]
      .filter((freight) => filter === 'all' || freight.status === filter)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });

  private readonly poller = new Poller(() => this.reload(), POLL_MS);

  ionViewWillEnter(): void {
    void this.load.run(() => this.reload());
    this.poller.start();
  }

  ionViewWillLeave(): void {
    this.poller.stop();
  }

  protected async refresh(event: Event): Promise<void> {
    await this.load.run(() => this.reload());
    completeRefresh(event);
  }

  protected onFilter(value: string | number | null | undefined): void {
    if (
      value === 'all' ||
      value === 'Open' ||
      value === 'Approved' ||
      value === 'Expired' ||
      value === 'Cancelled'
    ) {
      this.filter.set(value);
    }
  }

  private async reload(): Promise<void> {
    this.freights.set(await firstValueFrom(this.freightsApi.list()));
  }
}
