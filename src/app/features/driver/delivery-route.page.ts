import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonSegment,
  IonSegmentButton,
} from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { DriverMarketplaceService } from '../../core/api/driver-marketplace.service';
import { DeliveryRoute, RouteView } from '../../core/models';
import { completeRefresh } from '../../core/ui/refresher';
import { createRequestState } from '../../core/ui/request-state';
import { fromRouteStops } from '../../core/util/stop-views';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { PageBarComponent } from '../../shared/components/page-bar.component';
import { ProblemAlertComponent } from '../../shared/components/problem-alert.component';
import { StopsRouteComponent } from '../../shared/components/stops-route.component';

/**
 * The route of a delivery with full addresses. "Tudo" shows every stop of the run at once;
 * "Próxima" shows only the stop to do now, so the driver goes one stop after the other.
 */
@Component({
  selector: 'app-delivery-route-page',
  imports: [
    DecimalPipe,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonSegment,
    IonSegmentButton,
    EmptyStateComponent,
    PageBarComponent,
    ProblemAlertComponent,
    StopsRouteComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-bar title="Corrida" backHref="/driver/deliveries" />

    <ion-content>
      <ion-refresher slot="fixed" (ionRefresh)="refresh($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="page page--with-bar">
        <ion-segment [value]="view()" (ionChange)="onView($event.detail.value)">
          <ion-segment-button value="Full">Todas as paradas</ion-segment-button>
          <ion-segment-button value="Next">Próxima parada</ion-segment-button>
        </ion-segment>

        <app-problem-alert [error]="load.error()" />

        @if (route(); as r) {
          <section class="dark-panel stack">
            <h2>{{ r.cargoDescription }}</h2>
            <p class="muted small">{{ r.cargoWeightKg | number: '1.0-2' : 'pt-BR' }} kg</p>
            <div class="progress" role="progressbar" [attr.aria-valuenow]="r.completedStops" aria-valuemin="0" [attr.aria-valuemax]="r.totalStops">
              <span [style.width.%]="percent()"></span>
            </div>
            <p class="small">{{ r.completedStops }} de {{ r.totalStops }} paradas concluídas</p>
          </section>

          @if (stops().length > 0) {
            <app-stops-route [stops]="stops()" />
          } @else {
            <app-empty-state title="Todas as paradas concluídas" description="Não há mais nada a fazer nesta corrida." />
          }

          <p class="notice small">
            O registro de coleta e entrega (foto, código e assinatura) chega na próxima etapa da API.
          </p>
        } @else if (load.loading()) {
          <div class="skeleton"></div>
        }
      </div>
    </ion-content>
  `,
})
export class DeliveryRoutePage {
  private readonly marketplace = inject(DriverMarketplaceService);
  private readonly deliveryId = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  protected readonly load = createRequestState();
  protected readonly view = signal<RouteView>('Full');
  protected readonly route = signal<DeliveryRoute | null>(null);

  protected readonly stops = computed(() => fromRouteStops(this.route()?.stops ?? []));
  protected readonly percent = computed(() => {
    const r = this.route();
    return !r || r.totalStops === 0 ? 0 : Math.round((r.completedStops / r.totalStops) * 100);
  });

  ionViewWillEnter(): void {
    void this.reload();
  }

  protected async refresh(event: Event): Promise<void> {
    await this.reload();
    completeRefresh(event);
  }

  protected onView(value: string | number | null | undefined): void {
    if ((value === 'Full' || value === 'Next') && value !== this.view()) {
      this.view.set(value);
      void this.reload();
    }
  }

  private async reload(): Promise<void> {
    const route = await this.load.run(() =>
      firstValueFrom(this.marketplace.route(this.deliveryId, this.view())),
    );
    if (route) {
      this.route.set(route);
    }
  }
}
