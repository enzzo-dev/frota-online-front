import { DatePipe, DecimalPipe, CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonContent,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  ModalController,
} from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { DriverMarketplaceService } from '../../core/api/driver-marketplace.service';
import { DriverService } from '../../core/api/driver.service';
import { FreeFreightService } from '../../core/api/free-freight.service';
import { OpenFreight, Proposal, Vehicle } from '../../core/models';
import { VEHICLE_TYPE_LABEL } from '../../core/ui/labels';
import { completeRefresh } from '../../core/ui/refresher';
import { createRequestState } from '../../core/ui/request-state';
import { ToastService } from '../../core/ui/toast.service';
import { Poller } from '../../core/util/poller';
import { toUtcMillis } from '../../core/util/dates';
import { formatDistance, formatDuration } from '../../core/util/route-format';
import { StopView, fromOpenStops } from '../../core/util/stop-views';
import { CountdownComponent } from '../../shared/components/countdown.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { FreeFreightBannerComponent } from '../../shared/components/free-freight-banner.component';
import { HeroComponent } from '../../shared/components/hero.component';
import { MapPin, MapViewComponent } from '../../shared/components/map-view.component';
import { ProblemAlertComponent } from '../../shared/components/problem-alert.component';
import { StopsRouteComponent } from '../../shared/components/stops-route.component';
import { UtcPipe } from '../../shared/pipes/utc.pipe';
import { ProposalSheetComponent } from './proposal-sheet.component';

/** How often the board looks for new freights. Same-day freights only take proposals for 5 minutes. */
const BOARD_POLL_MS = 15_000;

function approxPins(freight: OpenFreight): MapPin[] {
  return [...freight.stops]
    .sort((a, b) => a.sequence - b.sequence)
    .filter((stop) => stop.approxLatitude !== null && stop.approxLongitude !== null)
    .map((stop) => ({
      latitude: stop.approxLatitude as number,
      longitude: stop.approxLongitude as number,
      sequence: stop.sequence,
      type: stop.type,
      label: `${stop.district}, ${stop.city}`,
    }));
}

interface BoardItem {
  readonly freight: OpenFreight;
  readonly stops: readonly StopView[];
  readonly distance: string | null;
  readonly duration: string | null;
  /** Rounded places of the stops that have them. Never a street. */
  readonly pins: readonly MapPin[];
  readonly eligibleVehicles: readonly Vehicle[];
  /** The driver's pending proposal on this freight, if any. */
  readonly pendingProposal: Proposal | null;
}

/** Open freights that fit the driver's vehicles, with a countdown to the end of each proposal window. */
@Component({
  selector: 'app-freight-board-page',
  imports: [
    DatePipe,
    DecimalPipe,
    CurrencyPipe,
    RouterLink,
    IonContent,
    IonIcon,
    IonRefresher,
    IonRefresherContent,
    CountdownComponent,
    EmptyStateComponent,
    FreeFreightBannerComponent,
    HeroComponent,
    MapViewComponent,
    ProblemAlertComponent,
    StopsRouteComponent,
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
          title="Fretes abertos"
          lede="Só aparecem fretes que cabem nos seus veículos. Você define o preço."
        />

        <app-free-freight-banner />
        <app-problem-alert [error]="load.error()" />

        @if (items(); as list) {
          @if (list.length === 0 && !load.loading()) {
            <app-empty-state
              title="Nenhum frete aberto agora"
              description="Novos fretes aparecem aqui sozinhos. Fretes do dia aceitam propostas por apenas 5 minutos."
            >
              @if (vehiclesLoaded() && vehicleCount() === 0) {
                <a class="btn btn--sm" routerLink="/driver/profile">Cadastrar um veículo</a>
              }
            </app-empty-state>
          }

          <div class="grid-cards">
            @for (item of list; track item.freight.id) {
              <article class="card stack">
                <div class="row row--between row--wrap">
                  <h3 class="grow break">{{ item.freight.cargoDescription }}</h3>
                  <span class="chip chip--outline">{{ typeLabel[item.freight.requiredVehicleType] }}</span>
                </div>

                <p class="muted small">
                  {{ item.freight.cargoWeightKg | number: '1.0-2' : 'pt-BR' }} kg ·
                  {{ item.freight.pickupCount }} {{ item.freight.pickupCount === 1 ? 'coleta' : 'coletas' }} ·
                  {{ item.freight.deliveryCount }} {{ item.freight.deliveryCount === 1 ? 'entrega' : 'entregas' }}
                </p>

                <p class="small">
                  @if (item.freight.scheduledPickupAt; as when) {
                    Coleta em <strong>{{ when | utc | date: "dd/MM 'às' HH:mm" }}</strong>
                  } @else {
                    <strong>Coleta hoje</strong>
                  }
                  · propostas por <app-countdown [until]="item.freight.proposalDeadline" />
                </p>

                <div class="route-line">
                  <ion-icon name="navigate-outline" aria-hidden="true" />
                  @if (item.distance; as distance) {
                    <strong>{{ distance }}</strong>
                    @if (item.duration; as time) {
                      <span>· cerca de {{ time }}</span>
                    }
                  } @else {
                    <span class="muted">Distância ainda não calculada</span>
                  }
                </div>

                <app-stops-route [stops]="item.stops" />

                @if (item.pins.length > 0) {
                  <button class="link-btn" type="button" [attr.aria-expanded]="isOpen(item.freight.id)" (click)="toggleMap(item.freight.id)">
                    <ion-icon name="map-outline" aria-hidden="true" />
                    {{ isOpen(item.freight.id) ? 'Esconder mapa' : 'Ver região no mapa' }}
                  </button>
                  @if (isOpen(item.freight.id)) {
                    <app-map-view
                      [pins]="item.pins"
                      [approximate]="true"
                      ariaLabel="Mapa aproximado das paradas do frete"
                    />
                    <p class="field-hint">
                      Os círculos mostram a região (cerca de 1 km), não o endereço. A rua completa aparece só depois que
                      você ganha o frete.
                    </p>
                  }
                }

                @if (item.pendingProposal; as proposal) {
                  <div class="notice row row--between">
                    <span>Sua proposta: <strong>{{ proposal.price | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}</strong></span>
                    <a class="link-btn" routerLink="/driver/proposals">Ver propostas</a>
                  </div>
                } @else if (item.eligibleVehicles.length === 0) {
                  <p class="field-hint">
                    Nenhum veículo ativo seu é do tipo {{ typeLabel[item.freight.requiredVehicleType] }} com
                    capacidade para {{ item.freight.cargoWeightKg | number: '1.0-2' : 'pt-BR' }} kg.
                  </p>
                } @else {
                  <button class="btn btn--block" type="button" (click)="openSheet(item)">
                    <ion-icon name="pricetag-outline" aria-hidden="true" />
                    Enviar proposta
                  </button>
                }
              </article>
            }
          </div>
        } @else if (load.loading()) {
          <div class="skeleton"></div>
          <div class="skeleton"></div>
        }
      </div>
    </ion-content>
  `,
})
export class FreightBoardPage {
  private readonly marketplace = inject(DriverMarketplaceService);
  private readonly driver = inject(DriverService);
  private readonly freeFreight = inject(FreeFreightService);
  private readonly modals = inject(ModalController);
  private readonly toast = inject(ToastService);

  protected readonly typeLabel = VEHICLE_TYPE_LABEL;
  protected readonly load = createRequestState();

  private readonly freights = signal<OpenFreight[] | null>(null);
  private readonly vehicles = signal<Vehicle[] | null>(null);
  private readonly proposals = signal<Proposal[]>([]);
  private readonly openMaps = signal<ReadonlySet<string>>(new Set());

  protected isOpen(id: string): boolean {
    return this.openMaps().has(id);
  }

  protected toggleMap(id: string): void {
    this.openMaps.update((current) => {
      const next = new Set(current);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });
  }

  protected readonly vehiclesLoaded = computed(() => this.vehicles() !== null);
  protected readonly vehicleCount = computed(() => this.vehicles()?.length ?? 0);

  protected readonly items = computed<BoardItem[] | null>(() => {
    const freights = this.freights();
    if (freights === null) {
      return null;
    }
    const vehicles = this.vehicles() ?? [];
    const pending = new Map(
      this.proposals()
        .filter((proposal) => proposal.status === 'Pending')
        .map((proposal) => [proposal.freightRequestId, proposal] as const),
    );
    return [...freights]
      .sort((a, b) => (toUtcMillis(a.proposalDeadline) ?? 0) - (toUtcMillis(b.proposalDeadline) ?? 0))
      .map((freight) => ({
        freight,
        stops: fromOpenStops(freight.stops),
        distance: formatDistance(freight.routeDistanceMeters),
        duration: formatDuration(freight.routeDurationSeconds),
        pins: approxPins(freight),
        eligibleVehicles: vehicles.filter(
          (vehicle) =>
            vehicle.isActive &&
            vehicle.type === freight.requiredVehicleType &&
            vehicle.capacityKg >= freight.cargoWeightKg,
        ),
        pendingProposal: pending.get(freight.id) ?? null,
      }));
  });

  private readonly poller = new Poller(() => this.reload(), BOARD_POLL_MS);

  ionViewWillEnter(): void {
    void this.freeFreight.refresh();
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

  protected async openSheet(item: BoardItem): Promise<void> {
    const sheet = await this.modals.create({
      component: ProposalSheetComponent,
      componentProps: { freight: item.freight, vehicles: item.eligibleVehicles },
      breakpoints: [0, 0.9],
      initialBreakpoint: 0.9,
      cssClass: 'sheet',
    });
    await sheet.present();
    const { role } = await sheet.onDidDismiss();
    if (role === 'submitted') {
      await this.toast.show('Proposta enviada. O cliente já pode ver o seu preço.');
      await this.load.run(() => this.reload());
    }
  }

  private async reload(): Promise<void> {
    const [freights, vehicles, proposals] = await Promise.all([
      firstValueFrom(this.marketplace.openFreights()),
      firstValueFrom(this.driver.vehicles()),
      firstValueFrom(this.marketplace.proposals()),
    ]);
    this.freights.set(freights);
    this.vehicles.set(vehicles);
    this.proposals.set(proposals);
  }
}
