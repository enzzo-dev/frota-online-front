import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent, IonRefresher, IonRefresherContent } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { DriverMarketplaceService } from '../../core/api/driver-marketplace.service';
import { DriverDeliverySummary } from '../../core/models';
import { DELIVERY_STATUS_VIEW } from '../../core/ui/labels';
import { completeRefresh } from '../../core/ui/refresher';
import { createRequestState } from '../../core/ui/request-state';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { HeroComponent } from '../../shared/components/hero.component';
import { ProblemAlertComponent } from '../../shared/components/problem-alert.component';
import { StatusChipComponent } from '../../shared/components/status-chip.component';
import { UtcPipe } from '../../shared/pipes/utc.pipe';

/** Deliveries the driver won, newest first. Each one opens its route. */
@Component({
  selector: 'app-deliveries-page',
  imports: [
    CurrencyPipe,
    DatePipe,
    RouterLink,
    IonContent,
    IonRefresher,
    IonRefresherContent,
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

      <div class="page">
        <app-hero
          title="Minhas corridas"
          lede="Fretes que você ganhou. Abra uma corrida para ver as paradas com o endereço completo."
        />

        <app-problem-alert [error]="load.error()" />

        @if (deliveries(); as list) {
          @if (list.length === 0 && !load.loading()) {
            <app-empty-state
              title="Nenhuma corrida ainda"
              description="Quando um cliente aprovar sua proposta, a corrida aparece aqui."
            >
              <a class="btn btn--sm" routerLink="/driver/freights">Ver fretes abertos</a>
            </app-empty-state>
          }

          <div class="stack">
            @for (delivery of list; track delivery.deliveryId) {
              <a class="card card--link stack" [routerLink]="['/driver/deliveries', delivery.deliveryId]">
                <div class="row row--between">
                  <span class="price price--lg">{{ delivery.agreedPrice | currency: 'BRL' : 'symbol' : '1.2-2' : 'pt-BR' }}</span>
                  <app-status-chip [view]="statusView[delivery.status]" />
                </div>
                <p class="muted small">
                  @if (delivery.scheduledPickupAt; as when) {
                    Coleta em {{ when | utc | date: "dd/MM 'às' HH:mm" }}
                  } @else {
                    Coleta no dia do pedido
                  }
                </p>
                <div class="progress" role="progressbar" [attr.aria-valuenow]="delivery.completedStops" aria-valuemin="0" [attr.aria-valuemax]="delivery.totalStops">
                  <span [style.width.%]="percent(delivery)"></span>
                </div>
                <p class="small">{{ delivery.completedStops }} de {{ delivery.totalStops }} paradas concluídas</p>
              </a>
            }
          </div>
        } @else if (load.loading()) {
          <div class="skeleton"></div>
        }
      </div>
    </ion-content>
  `,
})
export class DeliveriesPage {
  private readonly marketplace = inject(DriverMarketplaceService);

  protected readonly statusView = DELIVERY_STATUS_VIEW;
  protected readonly load = createRequestState();
  private readonly raw = signal<DriverDeliverySummary[] | null>(null);

  protected readonly deliveries = computed(() => {
    const list = this.raw();
    return list === null ? null : [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });

  ionViewWillEnter(): void {
    void this.reload();
  }

  protected async refresh(event: Event): Promise<void> {
    await this.reload();
    completeRefresh(event);
  }

  protected percent(delivery: DriverDeliverySummary): number {
    return delivery.totalStops === 0 ? 0 : Math.round((delivery.completedStops / delivery.totalStops) * 100);
  }

  private async reload(): Promise<void> {
    const list = await this.load.run(() => firstValueFrom(this.marketplace.deliveries()));
    if (list) {
      this.raw.set(list);
    }
  }
}
