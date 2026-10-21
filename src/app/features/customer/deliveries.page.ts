import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon, IonRefresher, IonRefresherContent } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { CustomerDeliveriesService } from '../../core/api/customer-deliveries.service';
import { CustomerDeliverySummary, DeliveryStatus } from '../../core/models';
import { DELIVERY_STATUS_VIEW, PAYMENT_STATUS_VIEW, VEHICLE_TYPE_LABEL } from '../../core/ui/labels';
import { completeRefresh } from '../../core/ui/refresher';
import { createRequestState } from '../../core/ui/request-state';
import { Poller } from '../../core/util/poller';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { HeroComponent } from '../../shared/components/hero.component';
import { ProblemAlertComponent } from '../../shared/components/problem-alert.component';
import { StatusChipComponent } from '../../shared/components/status-chip.component';

/** Deliveries still moving or just finished; the list refreshes on its own while one of them is running. */
const LIST_POLL_MS = 10_000;
const FINISHED: readonly DeliveryStatus[] = ['Delivered', 'Cancelled'];

/** Deliveries of the customer's approved freights: who is driving, how far along, and payment status. */
@Component({
  selector: 'app-customer-deliveries-page',
  imports: [
    CurrencyPipe,
    RouterLink,
    IonContent,
    IonIcon,
    IonRefresher,
    IonRefresherContent,
    EmptyStateComponent,
    HeroComponent,
    ProblemAlertComponent,
    StatusChipComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-content [fullscreen]="true">
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="page page--wide">
        <app-hero
          title="Entregas"
          lede="Acompanhe o motorista, as paradas já feitas e o pagamento de cada frete aprovado."
        />

        <app-problem-alert [error]="load.error()" />

        @if (deliveries(); as list) {
          @if (list.length === 0 && !load.loading()) {
            <app-empty-state
              title="Nenhuma entrega ainda"
              description="Quando você aprovar uma proposta, a entrega aparece aqui para acompanhar."
            >
              <a class="btn btn--sm" routerLink="/customer/freights">Ver meus fretes</a>
            </app-empty-state>
          }

          <div class="grid-cards">
            @for (delivery of list; track delivery.deliveryId) {
              <a class="card card--link stack" [routerLink]="['/customer/deliveries', delivery.deliveryId]">
                <div class="row row--between row--wrap">
                  <h3 class="grow break">{{ delivery.driverName }}</h3>
                  <app-status-chip [view]="statusView[delivery.status]" />
                </div>
                <p class="muted small">
                  {{ vehicleLabel[delivery.vehicleType] }} · {{ delivery.vehicleModel }} ·
                  <span class="mono">{{ delivery.vehiclePlate }}</span>
                </p>
                <div class="progress-track">
                  <div
                    class="progress"
                    role="progressbar"
                    [attr.aria-valuenow]="delivery.completedStops"
                    aria-valuemin="0"
                    [attr.aria-valuemax]="delivery.totalStops"
                  >
                    <span [style.width.%]="percent(delivery)"></span>
                  </div>
                  <ion-icon class="progress-track__vehicle" src="icons/bus.svg" aria-hidden="true" [style.left.%]="percent(delivery)" />
                </div>
                <div class="row row--between">
                  <p class="small">{{ delivery.completedStops }} de {{ delivery.totalStops }} paradas</p>
                  <span class="price">{{ delivery.agreedPrice | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}</span>
                </div>
                @if (delivery.payment; as payment) {
                  <app-status-chip [view]="paymentView[payment]" />
                }
              </a>
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
export class CustomerDeliveriesPage {
  private readonly api = inject(CustomerDeliveriesService);

  protected readonly statusView = DELIVERY_STATUS_VIEW;
  protected readonly paymentView = PAYMENT_STATUS_VIEW;
  protected readonly vehicleLabel = VEHICLE_TYPE_LABEL;
  protected readonly load = createRequestState();
  private readonly raw = signal<CustomerDeliverySummary[] | null>(null);

  /** Running ones first, then finished, each newest first. */
  protected readonly deliveries = computed(() => {
    const list = this.raw();
    if (list === null) {
      return null;
    }
    const rank = (d: CustomerDeliverySummary) => (FINISHED.includes(d.status) ? 1 : 0);
    return [...list].sort((a, b) => rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt));
  });

  private readonly poller = new Poller(() => this.fetch(), LIST_POLL_MS);

  ionViewWillEnter(): void {
    void this.load.run(() => this.fetch());
    this.poller.start();
  }

  ionViewWillLeave(): void {
    this.poller.stop();
  }

  protected async refresh(event: Event): Promise<void> {
    await this.load.run(() => this.fetch());
    completeRefresh(event);
  }

  protected percent(delivery: CustomerDeliverySummary): number {
    return delivery.totalStops === 0 ? 0 : Math.round((delivery.completedStops / delivery.totalStops) * 100);
  }

  private async fetch(): Promise<void> {
    this.raw.set(await firstValueFrom(this.api.list()));
  }
}
