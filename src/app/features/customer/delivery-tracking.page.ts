import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IonContent, IonRefresher, IonRefresherContent } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { CustomerDeliveriesService } from '../../core/api/customer-deliveries.service';
import { FreightsService } from '../../core/api/freights.service';
import { ApiError } from '../../core/http/api-error';
import { CustomerDeliveryDetail, RouteMap } from '../../core/models';
import { ConfirmService } from '../../core/ui/confirm.service';
import { DELIVERY_STATUS_VIEW, PAYMENT_STATUS_VIEW, VEHICLE_TYPE_LABEL } from '../../core/ui/labels';
import { completeRefresh } from '../../core/ui/refresher';
import { createRequestState } from '../../core/ui/request-state';
import { ToastService } from '../../core/ui/toast.service';
import { Poller } from '../../core/util/poller';
import { fromFreightStops } from '../../core/util/stop-views';
import { DeliveryTimelineComponent } from '../../shared/components/delivery-timeline.component';
import { PageBarComponent } from '../../shared/components/page-bar.component';
import { ProblemAlertComponent } from '../../shared/components/problem-alert.component';
import { RouteMapCardComponent } from '../../shared/components/route-map-card.component';
import { StatusChipComponent } from '../../shared/components/status-chip.component';
import { StopsRouteComponent } from '../../shared/components/stops-route.component';
import { UtcPipe } from '../../shared/pipes/utc.pipe';
import { DeliveryPaymentComponent } from './delivery-payment.component';

/** The API has no push or websocket yet, so a running delivery is polled every few seconds. */
const TRACK_POLL_MS = 5_000;

/** One delivery as its customer follows it: progress, stops, timeline, payment, and cancel before pickup. */
@Component({
  selector: 'app-delivery-tracking-page',
  imports: [
    CurrencyPipe,
    DatePipe,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    DeliveryPaymentComponent,
    DeliveryTimelineComponent,
    PageBarComponent,
    ProblemAlertComponent,
    RouteMapCardComponent,
    StatusChipComponent,
    StopsRouteComponent,
    UtcPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .detail {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 24px;
    }
    @media (min-width: 1000px) {
      .detail {
        grid-template-columns: minmax(0, 1fr) 400px;
        gap: 40px;
        align-items: start;
      }
    }
    .live {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .live::before {
      content: '';
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--red);
      animation: pulse 1.6s ease-in-out infinite;
    }
    @keyframes pulse {
      50% {
        opacity: 0.25;
      }
    }
  `,
  template: `
    <app-page-bar title="Entrega" backHref="/customer/deliveries" />

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="page page--wide page--with-bar">
        <app-problem-alert [error]="load.error()" />
        <app-problem-alert [error]="action.error()" />

        @if (delivery(); as d) {
          <section class="dark-panel stack">
            <div class="row row--between row--wrap">
              <h2 class="grow break">{{ d.driverName }}</h2>
              <app-status-chip [view]="statusView[d.status]" />
            </div>
            <p class="muted small">
              {{ vehicleLabel[d.vehicleType] }} · {{ d.vehicleModel }} · <span class="mono">{{ d.vehiclePlate }}</span>
            </p>
            <div
              class="progress"
              role="progressbar"
              [attr.aria-valuenow]="completed()"
              aria-valuemin="0"
              [attr.aria-valuemax]="d.stops.length"
            >
              <span [style.width.%]="percent()"></span>
            </div>
            <div class="row row--between row--wrap">
              <p class="small">{{ completed() }} de {{ d.stops.length }} paradas concluídas</p>
              @if (running()) {
                <span class="small live">Atualizando ao vivo</span>
              }
            </div>
          </section>

          <div class="detail">
            <div class="stack stack--lg">
              <section class="stack">
                <h2>Paradas</h2>
                <app-route-map-card [route]="route()" [loading]="routeLoading()" [error]="routeError()" />
                <app-stops-route [stops]="stops()" />
              </section>
            </div>

            <div class="stack stack--lg">
              <section class="card stack">
                <h3>Pagamento</h3>
                <dl class="kv">
                  <dt>Valor combinado</dt>
                  <dd>{{ d.agreedPrice | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}</dd>
                  <dt>Situação</dt>
                  <dd>
                    @if (d.payment; as payment) {
                      {{ paymentView[payment].label }}
                    } @else if (d.status === 'Delivered') {
                      Aguardando o pagamento
                    } @else {
                      Aguardando a entrega
                    }
                  </dd>
                </dl>
                @if (!payable()) {
                  <p class="field-hint">
                    O pagamento pode ser feito aqui no app (Pix, cartão ou Apple Pay), depois da entrega, ou direto com o motorista. Quando o
                    pagamento é confirmado, aparece aqui.
                  </p>
                }
              </section>

              @if (payable()) {
                <app-delivery-payment
                  [deliveryId]="d.deliveryId"
                  [amount]="d.agreedPrice"
                  (awaiting)="awaitingPayment.set($event)"
                  (changed)="reload()"
                />
              }

              <section class="stack">
                <h2>Linha do tempo</h2>
                @if (d.timeline.length > 0) {
                  <app-delivery-timeline [events]="d.timeline" />
                } @else {
                  <p class="muted small">Ainda não há movimentações. Assim que o motorista agir, aparece aqui.</p>
                }
                @if (d.deliveredAt; as at) {
                  <p class="small">Entregue em {{ at | utc | date: "dd/MM 'às' HH:mm" }}</p>
                }
                @if (d.cancelledAt; as at) {
                  <p class="small">Cancelada em {{ at | utc | date: "dd/MM 'às' HH:mm" }}</p>
                }
              </section>

              @if (cancellable()) {
                <button class="btn btn--danger-outline btn--block" type="button" [disabled]="action.loading()" (click)="confirmCancel(d)">
                  Cancelar entrega
                </button>
                <p class="field-hint">Só é possível cancelar antes de o motorista coletar a carga.</p>
              }
            </div>
          </div>
        } @else if (load.loading()) {
          <div class="skeleton"></div>
          <div class="skeleton"></div>
        }
      </div>
    </ion-content>
  `,
})
export class DeliveryTrackingPage {
  private readonly api = inject(CustomerDeliveriesService);
  private readonly freights = inject(FreightsService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly deliveryId = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  protected readonly statusView = DELIVERY_STATUS_VIEW;
  protected readonly paymentView = PAYMENT_STATUS_VIEW;
  protected readonly vehicleLabel = VEHICLE_TYPE_LABEL;
  protected readonly load = createRequestState();
  protected readonly action = createRequestState();
  /** A Pix or card payment is waiting for the provider: keep polling so it shows up by itself. */
  protected readonly awaitingPayment = signal(false);

  protected readonly delivery = signal<CustomerDeliveryDetail | null>(null);
  protected readonly route = signal<RouteMap | null>(null);
  protected readonly routeLoading = signal(false);
  protected readonly routeError = signal<ApiError | null>(null);

  protected readonly stops = computed(() => fromFreightStops(this.delivery()?.stops ?? []));
  protected readonly completed = computed(() => this.delivery()?.stops.filter((s) => s.completedAt !== null).length ?? 0);
  protected readonly percent = computed(() => {
    const total = this.delivery()?.stops.length ?? 0;
    return total === 0 ? 0 : Math.round((this.completed() / total) * 100);
  });
  protected readonly running = computed(() => {
    const status = this.delivery()?.status;
    return status !== undefined && status !== 'Delivered' && status !== 'Cancelled';
  });
  /** Delivered and not paid yet: the customer can pay by Pix in the app. */
  protected readonly payable = computed(() => {
    const d = this.delivery();
    return d !== null && d.status === 'Delivered' && d.payment !== 'Paid';
  });
  protected readonly cancellable = computed(() => {
    const status = this.delivery()?.status;
    return status === 'Scheduled' || status === 'ToPickup';
  });

  private readonly poller = new Poller(async () => {
    // Keeps going after delivery while a payment is waiting, so the payment shows up by itself.
    if (this.running() || (this.awaitingPayment() && this.payable())) {
      await this.fetch();
    }
  }, TRACK_POLL_MS);
  private routeRequested = false;

  ionViewWillEnter(): void {
    void this.load.run(() => this.fetch());
    this.poller.start();
  }

  ionViewWillLeave(): void {
    this.poller.stop();
  }

  protected async reload(): Promise<void> {
    await this.load.run(() => this.fetch());
  }

  protected async refresh(event: Event): Promise<void> {
    await this.load.run(() => this.fetch());
    completeRefresh(event);
  }

  protected async confirmCancel(delivery: CustomerDeliveryDetail): Promise<void> {
    const reason = await this.confirm.promptText({
      header: 'Cancelar entrega?',
      message: 'O motorista será avisado. Conte o motivo.',
      label: 'Motivo do cancelamento',
      placeholder: 'Ex.: não preciso mais do frete',
      confirmText: 'Cancelar entrega',
      cancelText: 'Manter',
      destructive: true,
    });
    if (reason === null) {
      return;
    }
    const done = await this.action.run(async () => {
      await firstValueFrom(this.api.cancel(delivery.deliveryId, reason));
      return true;
    });
    if (done) {
      await this.toast.show('Entrega cancelada.');
    }
    // After delivery.invalid_status (the driver collected meanwhile) this shows the real state.
    await this.load.run(() => this.fetch());
  }

  private async fetch(): Promise<void> {
    const detail = await firstValueFrom(this.api.get(this.deliveryId));
    this.delivery.set(detail);
    if (!this.routeRequested) {
      this.routeRequested = true;
      void this.loadRoute(detail.freightRequestId);
    }
  }

  private async loadRoute(freightId: string): Promise<void> {
    this.routeLoading.set(true);
    try {
      this.route.set(await firstValueFrom(this.freights.route(freightId)));
    } catch (caught) {
      this.routeError.set(ApiError.from(caught));
    } finally {
      this.routeLoading.set(false);
    }
  }
}
